import { fileURLToPath } from "node:url";

import { readSupabaseStatus } from "../../../scripts/supabaseStatus";

import type { StackConfig } from "./stack";

// packages/db, which holds the Supabase project the CLI reads the stack status for.
const databaseWorkdir = fileURLToPath(new URL("../../..", import.meta.url));

const stackHint = 'Start it with "pnpm dev:db" from the repository root, then run the tests again.';

// Fast enough to fail fast when nothing listens.
const healthTimeoutMilliseconds = 15_000;

/** The running local stack, or a failure that says how to start it. Every integration suite's global setup begins here. */
export async function requireStack(): Promise<StackConfig> {
  let stack: StackConfig;
  try {
    stack = await readSupabaseStatus(databaseWorkdir);
    const health = await fetch(`${stack.apiUrl}/auth/v1/health`, {
      headers: { apikey: stack.anonKey },
      signal: AbortSignal.timeout(healthTimeoutMilliseconds),
    });
    if (!health.ok) {
      throw new Error(`The auth health check answered ${health.status}`);
    }
  } catch (cause) {
    throw new Error(`The local Supabase stack is not available. ${stackHint}`, { cause });
  }
  return stack;
}
