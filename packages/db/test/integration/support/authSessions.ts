// Sessions of the kinds the delete-account freshness rule tells apart, made through the admin API of the
// local stack: a session from a recovery link or a magic link (its `amr` holds `otp`, never `password`),
// an account that looks like a Google or a linked one, and a session whose password sign-in is made old.
// Nothing here prints a token, an email or a password.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { adminClient, anonClient } from "./stack";

import type { TestUser } from "./users";
import type { Database } from "../../../src/types.gen";
import type { SupabaseClient } from "@supabase/supabase-js";

const run = promisify(execFile);

// The CLI is the one pinned in this package, run from here so `supabase` finds this project.
const databasePackageDirectory = new URL("../../../", import.meta.url).pathname;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** The claims in an access token's payload. It reads and does not verify, so only the test's own tokens belong here. */
export function claimsOf(accessToken: string): Record<string, unknown> {
  const payload = accessToken.split(".")[1];
  if (payload === undefined) {
    throw new Error("The access token has no payload");
  }
  const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!isRecord(claims)) {
    throw new Error("The access token payload is not an object");
  }
  return claims;
}

/** The `amr` claim of one of the test's own tokens, and `undefined` when there is none. */
export const amrOf = (accessToken: string): unknown => claimsOf(accessToken)["amr"];

/** The timestamp, in epoch seconds, of the newest password entry in the token's `amr`. Throws when there is none. */
export function passwordTimestampOf(accessToken: string): number {
  const amr = amrOf(accessToken);
  const timestamps = (Array.isArray(amr) ? amr : []).flatMap((entry: unknown) =>
    isRecord(entry) && entry["method"] === "password" && typeof entry["timestamp"] === "number"
      ? [entry["timestamp"]]
      : [],
  );
  if (timestamps.length === 0) {
    throw new Error("The access token has no password entry in its amr");
  }
  return Math.max(...timestamps);
}

/** The `session_id` of one of the test's own tokens. It must be a uuid, because it goes into a statement. */
export function sessionIdOf(accessToken: string): string {
  const sessionId = claimsOf(accessToken)["session_id"];
  if (typeof sessionId !== "string" || !uuidPattern.test(sessionId)) {
    throw new Error("The access token has no session id");
  }
  return sessionId;
}

export type LinkSession = { accessToken: string; client: SupabaseClient<Database> };

/**
 * Signs the user in with a link instead of the password, the way a reset email or a magic link does: the
 * admin API makes the link, and its token hash is exchanged for a session. A new client holds the session.
 */
export async function signInWithLink(
  user: TestUser,
  kind: "recovery" | "magiclink",
): Promise<LinkSession> {
  const { data: link, error: linkError } = await adminClient().auth.admin.generateLink({
    type: kind,
    email: user.email,
  });
  if (linkError !== null) {
    throw new Error(`Could not make a ${kind} link (${linkError.code ?? "unknown"})`);
  }

  const client = anonClient();
  const { data, error } = await client.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: kind,
  });
  if (error !== null || data.session === null) {
    throw new Error(`Could not use a ${kind} link (${error?.code ?? "no session"})`);
  }
  return { accessToken: data.session.access_token, client };
}

/**
 * Gives the account the `app_metadata` of a Google-only account. Google is not configured on the local stack.
 * Call it after `signInWithLink`: using a link sets `providers` back to email, so the shape does not survive one.
 */
export async function makeGoogleOnly(userId: string): Promise<void> {
  await setProviders(userId, "google", ["google"]);
}

/** Gives the account the `app_metadata` of an email account that has linked Google. */
export async function makeEmailAndGoogle(userId: string): Promise<void> {
  await setProviders(userId, "email", ["email", "google"]);
}

async function setProviders(userId: string, provider: string, providers: string[]): Promise<void> {
  const { error } = await adminClient().auth.admin.updateUserById(userId, {
    app_metadata: { provider, providers },
  });
  if (error !== null) {
    throw new Error(`Could not set the account's providers (${error.code ?? "unknown"})`);
  }
}

/**
 * Makes the session's password sign-in older by `minutes`, by updating that session's own row in
 * `auth.mfa_amr_claims`, which is where the auth service reads the `amr` claim from when it signs a token.
 * The next `refreshSession` then signs a token whose password entry is that much older, with a recent
 * `iat`. It touches the local database through the pinned CLI with `--local`, never any other target, and
 * builds the statement itself from a uuid it has checked and a whole number of minutes.
 */
export async function agePasswordEntry(accessToken: string, minutes: number): Promise<void> {
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error("The age must be a whole number of minutes above zero");
  }
  const sessionId = sessionIdOf(accessToken);
  const statement =
    "update auth.mfa_amr_claims " +
    `set created_at = created_at - interval '${minutes} minutes', ` +
    `updated_at = updated_at - interval '${minutes} minutes' ` +
    `where session_id = '${sessionId}' and authentication_method = 'password' returning id`;

  const { stdout } = await run(
    "pnpm",
    ["exec", "supabase", "db", "query", "--local", "--output", "json", statement],
    { cwd: databasePackageDirectory },
  );
  const document: unknown = JSON.parse(stdout.slice(stdout.indexOf("{")));
  const rows = isRecord(document) ? document["rows"] : undefined;
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("Expected to age exactly one password entry");
  }
}
