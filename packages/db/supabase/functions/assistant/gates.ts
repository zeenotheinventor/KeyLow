// The access gates every assistant request passes before a token is spent, in this order: the kill
// switch, consent, the entitlement, the user's daily turns, the global monthly spend (plan 2.7). A
// failure is one typed notice, which the app words. This file sends codes, never words.
import { readLimit } from "../_shared/rateLimit.ts";

import type { AssistantNotice } from "../_shared/core.ts";
import type { Database } from "../_shared/core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

const dailyWindowSeconds = 86_400;

// What the gates read and the one thing they write. Every method is for the verified user, whose id
// the function took from the JWT.
export type AccessStore = {
  hasConsented(userId: string): Promise<boolean>;
  hasEntitlement(userId: string): Promise<boolean>;
  // Null is the unlimited plan: no daily cap.
  dailyTurns(userId: string): Promise<number | null>;
  // Counts one hit against today's bucket. True while the hit is within the limit.
  consumeTurn(userId: string, dailyTurns: number): Promise<boolean>;
  // How many turns the user has started since `since`, without consuming one.
  turnsStartedSince(userId: string, since: Date): Promise<number>;
  spendThisMonth(): Promise<number>;
};

export type AccessContext = { userId: string; store: AccessStore; now: Date };

// `spend` true is a turn, which uses one of today's turns. False is the status route, which only looks.
export async function checkAccess(
  context: AccessContext,
  options: { spend: boolean },
): Promise<AssistantNotice | null> {
  const { userId, store, now } = context;
  // Any non-empty value switches the assistant off. It moves to a feature flag when Ki-Lo has flags.
  if ((Deno.env.get("ASSISTANT_DISABLED") ?? "") !== "") {
    return { code: "switched_off" };
  }
  if (!(await store.hasConsented(userId))) {
    return { code: "consent_needed" };
  }
  if (!(await store.hasEntitlement(userId))) {
    return { code: "plus" };
  }
  // Read before the daily gate consumes, so a malformed value fails without burning a turn. It is read
  // only here, and through readLimit, so the figure lives in one place.
  const monthlyCap = readLimit("ASSISTANT_MONTHLY_CAP_USD_MICROS", 10_000_000);
  const dailyTurns = await store.dailyTurns(userId);
  // The unlimited plan has no daily cap, so it is never counted and never gets the day limit.
  if (dailyTurns !== null && !(await withinDailyTurns(context, dailyTurns, options.spend))) {
    return { code: "day_limit", resetsAt: toInstant(nextUtcMidnight(now)) };
  }
  if ((await store.spendThisMonth()) >= monthlyCap) {
    return { code: "resting", resumesOn: firstOfNextMonth(now) };
  }
  return null;
}

async function withinDailyTurns(
  { userId, store, now }: AccessContext,
  dailyTurns: number,
  spend: boolean,
): Promise<boolean> {
  if (spend) {
    return await store.consumeTurn(userId, dailyTurns);
  }
  return (await store.turnsStartedSince(userId, startOfUtcDay(now))) < dailyTurns;
}

// consume_rate_limit bins its windows from the epoch, so a 86,400 second window is a UTC day.
function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

// Whole seconds, as the contract's example prints it.
function toInstant(date: Date): string {
  return date.toISOString().replace(".000Z", "Z");
}

function firstOfNextMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

function failure(operation: string, error: { code?: string } | null): Error {
  return new Error(`assistant access ${operation} failed ${error?.code ?? "unknown"}`);
}

// The service client reads what the caller cannot: `assistant_access` and `has_entitlement` are
// service role only, and `entitlements` has no select for the service role. The error message of a
// failed call is left out, so a failure never carries a row's content.
export function createAccessStore(client: SupabaseClient<Database>): AccessStore {
  return {
    async hasConsented(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("assistant_consent_at")
        .eq("id", userId)
        .maybeSingle();
      if (error !== null) {
        throw failure("read consent", error);
      }
      return data?.assistant_consent_at != null;
    },

    async hasEntitlement(userId) {
      const { data, error } = await client.rpc("has_entitlement", {
        p_user_id: userId,
        p_feature: "assistant",
      });
      if (error !== null) {
        throw failure("read entitlement", error);
      }
      return data;
    },

    async dailyTurns(userId) {
      const { data, error } = await client.rpc("assistant_access", { p_user_id: userId }).single();
      if (error !== null) {
        throw failure("read access", error);
      }
      // The generated type says number, but the unlimited plan returns null.
      const dailyTurns: number | null = data.daily_turns;
      return dailyTurns;
    },

    async consumeTurn(userId, dailyTurns) {
      const { data, error } = await client
        .rpc("consume_rate_limit", {
          p_bucket: `assistant:turns:${userId}`,
          p_max: dailyTurns,
          p_window_seconds: dailyWindowSeconds,
        })
        .single();
      if (error !== null) {
        throw failure("consume a turn", error);
      }
      return data.allowed;
    },

    // `rate_limits` grants the service role nothing, so the count comes from the turn rows. It
    // approximates the bucket and does not equal it. A turn that was consumed and then refused
    // (the conversation is not the caller's, resting, a failed insert) leaves the bucket ahead of the
    // count. A deleted conversation cascades its turns away, which leaves the count behind. The `turn`
    // route stays authoritative: it consumes from the bucket itself.
    async turnsStartedSince(userId, since) {
      const { count, error } = await client
        .from("assistant_turns")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since.toISOString());
      if (error !== null) {
        throw failure("count turns", error);
      }
      return count ?? 0;
    },

    async spendThisMonth() {
      const { data, error } = await client.rpc("assistant_spend_this_month");
      if (error !== null) {
        throw failure("read spend", error);
      }
      return Number(data);
    },
  };
}
