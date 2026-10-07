import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import type { StackConfig } from "./stack";
import type { TestProject } from "vitest/node";

const run = promisify(execFile);

// packages/db, which holds the Supabase project the CLI reads the stack status for.
const databaseWorkdir = fileURLToPath(new URL("../../../../db", import.meta.url));

const startHint = 'Start it with "pnpm dev:db" from the repository root, then run the tests again.';

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

export default async function setup(project: TestProject) {
  try {
    project.provide("stack", toStackConfig(await readStackStatus()));
  } catch (cause) {
    throw new Error(`The local Supabase stack is not available. ${startHint}`, { cause });
  }
}
