import { featureRequestInputSchema } from "@keylow/core/featureRequests";

import { repoError } from "./repoError";

import type { Database } from "../database.types";
import type { FeatureRequestInput } from "@keylow/core/featureRequests";
import type { SupabaseClient } from "@supabase/supabase-js";

// A request can hold diary talk, so it is health data (ADR 0003, Amendment 21). A failure names the
// action and a code only. Neither the text, the context nor the database's own message is kept.

const ACTION = "send the feature request";

// What the daily cap trigger raises. Both must match, so another program-limit error is not the cap.
const DAILY_CAP_CODE = "54000";
const DAILY_CAP_MESSAGE = "feature_requests_daily_cap";

// The code a failed send carries when the daily cap is reached.
const RATE_LIMITED_CODE = "rate_limited";

/**
 * Files one feature request for the signed in user and resolves to its id. The text and the context
 * are checked with the core schemas first, so nothing invalid is sent. The database gives the row its
 * owner. The 21st request in 24 hours fails with the code `rate_limited`.
 */
export async function createFeatureRequest(
  client: SupabaseClient<Database>,
  input: FeatureRequestInput,
): Promise<{ id: string }> {
  const parsed = featureRequestInputSchema.safeParse(input);
  if (!parsed.success) {
    throw repoError(ACTION, { code: "invalid" });
  }

  const { data, error } = await client
    .from("feature_requests")
    .insert({
      source: parsed.data.source,
      request: parsed.data.request,
      context: parsed.data.context,
    })
    .select("id")
    .single();

  if (error) {
    const isDailyCap = error.code === DAILY_CAP_CODE && error.message === DAILY_CAP_MESSAGE;
    throw repoError(ACTION, { code: isDailyCap ? RATE_LIMITED_CODE : error.code });
  }

  return { id: data.id };
}

/** Whether a failed send was the daily cap, so a screen can say to try again tomorrow. */
export function isDailyLimitFailure(failure: unknown): boolean {
  return (
    failure instanceof Error &&
    typeof failure.cause === "object" &&
    failure.cause !== null &&
    "code" in failure.cause &&
    failure.cause.code === RATE_LIMITED_CODE
  );
}
