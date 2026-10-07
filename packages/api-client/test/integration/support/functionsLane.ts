// The global setup side of calling the served `off-product` function against the Open Food Facts
// mock. The mock server is the one @keylow/db uses for its function suites, imported rather than
// copied so the two cannot drift apart. The function container reaches the mock on one fixed port,
// so only one test run at a time can start it.
import { offMockPort } from "../../../../db/test/integration/support/offMock";
import { startOffMock } from "../../../../db/test/integration/support/offMockServer";

import type { StackConfig } from "./stack";

const functionsHint =
  "Serve the functions in another terminal with " +
  '"pnpm --filter @keylow/db bundle-core-for-deno" and then, from packages/db, ' +
  '"supabase functions serve --env-file supabase/functions/.env.test --no-verify-jwt". ' +
  "Wait for it to print that it is serving, then run the tests again.";

// Fast enough to fail fast when nothing listens, slow enough for a function's first cold start.
const probeTimeoutMilliseconds = 15_000;

/**
 * Fails with a hint unless `functions serve` answers for `name`. It answers the CORS preflight (204)
 * or, when the gateway checks the JWT, a 401. Anything else means it is not running or the function
 * failed to boot.
 */
export async function requireServedFunction(stack: StackConfig, name: string): Promise<void> {
  let status: number;

  try {
    const probe = await fetch(`${stack.apiUrl}/functions/v1/${name}`, {
      method: "OPTIONS",
      headers: { apikey: stack.anonKey },
      signal: AbortSignal.timeout(probeTimeoutMilliseconds),
    });
    await probe.body?.cancel();
    status = probe.status;
  } catch (cause) {
    throw new Error(`The ${name} function is not being served. ${functionsHint}`, { cause });
  }

  if (status !== 204 && status !== 401) {
    throw new Error(
      `The ${name} function answered ${status} to a preflight, so it is not being served. ${functionsHint}`,
    );
  }
}

/** Starts the Open Food Facts mock on its port and returns what stops it. */
export async function startOffMockOrExplain(): Promise<() => Promise<void>> {
  try {
    return (await startOffMock(offMockPort)).close;
  } catch (cause) {
    throw new Error(
      `Could not start the Open Food Facts mock on port ${offMockPort}. Another test run is probably using it.`,
      { cause },
    );
  }
}
