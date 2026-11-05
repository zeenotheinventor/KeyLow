import { TERMS_VERSION, assistantNoticeSchema } from "@keylow/core";
import { z } from "zod";

import { repoError } from "./repoError";

import type { Database } from "../database.types";
import type { AssistantNotice } from "@keylow/core";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Whether the signed in user turned the assistant on, and when and under which Terms version. */
export type AssistantConsent = {
  isOn: boolean;
  consentedAt: string | null;
  version: string | null;
};

/**
 * Reads the assistant consent on the signed in user's own profile. Row level security only shows a user
 * their own row, so no id is needed. The two columns are set together, so `isOn` is whether the time is
 * set. A user with no profile row reads as off.
 */
export async function getAssistantConsent(
  client: SupabaseClient<Database>,
): Promise<AssistantConsent> {
  const { data, error } = await client
    .from("profiles")
    .select("assistant_consent_at, assistant_consent_version")
    .maybeSingle();

  if (error) {
    throw repoError("load your assistant setting", error);
  }

  return {
    isOn: data?.assistant_consent_at != null,
    consentedAt: data?.assistant_consent_at ?? null,
    version: data?.assistant_consent_version ?? null,
  };
}

/**
 * Turns the assistant on for the user, by setting the consent time to now and the version to the current
 * `TERMS_VERSION`, or off, by clearing both. Only those two columns are written (the column grant allows
 * it), and row level security limits the update to the user's own row. An update that reaches no row
 * (someone else's id, or no profile) changes nothing, so it throws rather than reporting a success.
 */
export async function setAssistantConsent(
  client: SupabaseClient<Database>,
  userId: string,
  on: boolean,
) {
  const { data, error } = await client
    .from("profiles")
    .update({
      assistant_consent_at: on ? new Date().toISOString() : null,
      assistant_consent_version: on ? TERMS_VERSION : null,
    })
    .eq("id", userId)
    .select("id");

  if (error) {
    throw repoError("save your assistant setting", error);
  }
  if (data.length === 0) {
    throw new Error("Could not save your assistant setting: no profile was changed");
  }
}

const assistantStatusSchema = z.object({ notice: assistantNoticeSchema.nullable() });

/** What the status route says: the notice that stops the assistant, or null when it is open. */
export type AssistantStatus = { notice: AssistantNotice | null };

/**
 * Asks the `assistant` function's status route whether a turn would be allowed, without using one. It
 * counts today's turns rather than reading the daily limit, so the stream of a turn stays the authority.
 * `functionsUrl` is the base URL of the Edge Functions, and `signal` cancels the request. A failed call
 * names the HTTP status only.
 */
export async function getAssistantStatus(
  client: SupabaseClient<Database>,
  functionsUrl: string,
  signal?: AbortSignal,
): Promise<AssistantStatus> {
  const { data, error } = await client.auth.getSession();
  if (error || data.session === null) {
    throw new Error("Could not check the assistant: you are not signed in", { cause: error });
  }

  const response = await fetch(`${functionsUrl}/assistant/status`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    signal: signal ?? null,
  });
  if (!response.ok) {
    throw new Error(`Could not check the assistant: the status route answered ${response.status}`);
  }

  const parsed = assistantStatusSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Could not check the assistant: the answer was not a status");
  }
  return parsed.data;
}
