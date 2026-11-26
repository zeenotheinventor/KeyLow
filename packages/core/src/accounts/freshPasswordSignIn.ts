import { hasPasswordSignIn } from "./hasPasswordSignIn";

/**
 * How long after a password sign-in an account may still be deleted: 15 minutes, Zee's ruling of 2026-11-24 on
 * KEY-1124. It is long enough for "Try again" in the same sitting, and the screen asks for the password again
 * once it has run out.
 */
export const FRESH_PASSWORD_WINDOW_SECONDS = 15 * 60;

/**
 * `notRequired`: the account has no password sign-in (Google only). `fresh`: a password sign-in inside the
 * window. `stale`: the newest one is older. `missing`: the session holds no password sign-in at all, as a reset
 * link, a magic link or Google sign-in session does.
 */
export type FreshPasswordVerdict = "notRequired" | "fresh" | "stale" | "missing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The timestamps, in epoch seconds, of the password entries in an `amr` claim. Anything else is skipped. */
function passwordTimestamps(amr: unknown): number[] {
  if (!Array.isArray(amr)) {
    return [];
  }

  return amr.flatMap((entry: unknown) =>
    isRecord(entry) && entry.method === "password" && Number.isFinite(entry.timestamp)
      ? [Number(entry.timestamp)]
      : [],
  );
}

/**
 * Whether an account may be deleted now, from the verified user's `app_metadata` (the auth database's row,
 * never the token's copy) and the `amr` claim of the verified access token. A refreshed session keeps the
 * time of its original sign-in in `amr`, so an old session cannot pass as fresh by refreshing. A timestamp
 * ahead of `nowSeconds` counts as fresh, since the token was signed by the auth service and the difference
 * is clock skew.
 */
export function freshPasswordVerdict({
  appMetadata,
  amr,
  nowSeconds,
}: {
  appMetadata: unknown;
  amr: unknown;
  nowSeconds: number;
}): FreshPasswordVerdict {
  if (!hasPasswordSignIn(appMetadata)) {
    return "notRequired";
  }

  const timestamps = passwordTimestamps(amr);
  if (timestamps.length === 0) {
    return "missing";
  }

  // A reduce, not `Math.max(...timestamps)`: spreading a huge array throws a RangeError.
  const newest = timestamps.reduce((latest, timestamp) => Math.max(latest, timestamp));

  return nowSeconds - newest <= FRESH_PASSWORD_WINDOW_SECONDS ? "fresh" : "stale";
}
