import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { offMockPort } from "./offMock";
import { startOffMock } from "./offMockServer";

import type { StackConfig } from "./stack";
import type { TestProject } from "vitest/node";

const run = promisify(execFile);

// packages/db, which holds the Supabase project the CLI reads the stack status for.
const databaseWorkdir = fileURLToPath(new URL("../../..", import.meta.url));

const stackHint = 'Start it with "pnpm dev:db" from the repository root, then run the tests again.';
const functionsHint =
  "Serve the functions in another terminal with " +
  '"pnpm --filter @keylow/db bundle-core-for-deno" and then, from packages/db, ' +
  '"supabase functions serve --env-file supabase/functions/.env.test --no-verify-jwt". ' +
  "Wait for it to print that it is serving, then run the tests again.";

// Fast enough to fail fast when nothing listens, slow enough for a function's first cold start.
const probeTimeoutMilliseconds = 15_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

async function readStackStatus(): Promise<unknown> {
  const { stdout } = await run(
    "supabase",
    ["status", "--workdir", databaseWorkdir, "--output", "json"],
    { timeout: 30_000 },
  );

  // The CLI can print notices before the JSON document.
  return JSON.parse(stdout.slice(stdout.indexOf("{")));
}

function toStackConfig(status: unknown): StackConfig {
  if (
    !isRecord(status) ||
    typeof status["API_URL"] !== "string" ||
    typeof status["ANON_KEY"] !== "string" ||
    typeof status["SERVICE_ROLE_KEY"] !== "string"
  ) {
    throw new Error("API_URL, ANON_KEY or SERVICE_ROLE_KEY is missing from the status output");
  }

  return {
    apiUrl: status["API_URL"],
    anonKey: status["ANON_KEY"],
    serviceRoleKey: status["SERVICE_ROLE_KEY"],
  };
}

async function requireStack(): Promise<StackConfig> {
  let stack: StackConfig;
  try {
    stack = toStackConfig(await readStackStatus());
    const health = await fetch(`${stack.apiUrl}/auth/v1/health`, {
      headers: { apikey: stack.anonKey },
      signal: AbortSignal.timeout(probeTimeoutMilliseconds),
    });
    if (!health.ok) {
      throw new Error(`The auth health check answered ${health.status}`);
    }
  } catch (cause) {
    throw new Error(`The local Supabase stack is not available. ${stackHint}`, { cause });
  }
  return stack;
}

// `functions serve` answers the CORS preflight (204) or, when the gateway checks the JWT, a 401.
// Anything else means it is not running (the gateway answers 502 or 503) or the function failed to boot.
async function requireServedFunction(stack: StackConfig, name: string): Promise<void> {
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

async function startMock(): Promise<() => Promise<void>> {
  try {
    const mock = await startOffMock(offMockPort);
    return mock.close;
  } catch (cause) {
    throw new Error(
      `Could not start the Open Food Facts mock on port ${offMockPort}. Another test run is probably using it.`,
      { cause },
    );
  }
}

export default async function setup(project: TestProject) {
  const stack = await requireStack();
  await requireServedFunction(stack, "off-product");
  project.provide("stack", stack);
  return await startMock();
}
