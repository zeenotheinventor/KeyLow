// The functions count rate limits in fixed windows aligned to the epoch (see consume_rate_limit).
// A test that spends a limit with a run of calls fails if the window ends in the middle of it,
// because the hits are split across two windows and neither passes the limit. This waits for a
// fresh window when too little of the current one is left, so a burst always lands in one.
import { inject } from "vitest";

/** The window the functions use, in milliseconds. */
export const rateLimitWindowMilliseconds = 60_000;

// A burst of a few calls takes a second or two. This leaves several times that.
const burstMilliseconds = 10_000;

// The Date header has whole seconds and rounds the time down, so it can be up to a second behind.
const clockResolutionMilliseconds = 1_000;

export function millisecondsToWaitForFreshWindow(options: {
  serverTimeMilliseconds: number;
  windowMilliseconds: number;
  neededMilliseconds: number;
}): number {
  const { serverTimeMilliseconds, windowMilliseconds, neededMilliseconds } = options;
  const millisecondsLeft = windowMilliseconds - (serverTimeMilliseconds % windowMilliseconds);
  return millisecondsLeft >= neededMilliseconds
    ? 0
    : millisecondsLeft + clockResolutionMilliseconds;
}

// The stack's own clock, which is the one the database windows by. The test process may be on
// another clock (Docker Desktop's VM drifts from the host after it sleeps), so it is not used.
async function readServerTimeMilliseconds(): Promise<number> {
  const { apiUrl, anonKey } = inject("stack");
  const response = await fetch(`${apiUrl}/auth/v1/health`, { headers: { apikey: anonKey } });
  await response.body?.cancel();
  const date = response.headers.get("date");
  if (date === null || Number.isNaN(Date.parse(date))) {
    throw new Error(`The gateway sent no usable Date header, it sent ${String(date)}`);
  }
  return Date.parse(date);
}

/**
 * Returns once at least ten seconds of the current rate limit window are left, waiting for the
 * next window when that is not so. Call it right before a run of calls that spends a limit.
 */
export async function waitForFreshRateLimitWindow(): Promise<void> {
  const wait = millisecondsToWaitForFreshWindow({
    serverTimeMilliseconds: await readServerTimeMilliseconds(),
    windowMilliseconds: rateLimitWindowMilliseconds,
    neededMilliseconds: burstMilliseconds,
  });
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}
