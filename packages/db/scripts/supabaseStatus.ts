// The one place that asks the Supabase CLI where the local stack is. The CoFID import script and
// the integration suites' global setups all read it from here, so none of them parses the output itself.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type SupabaseStatus = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Reads the stack's URL and keys from the output of `supabase status --output json`. */
export function parseSupabaseStatus(output: string): SupabaseStatus {
  // The CLI can print notices before the JSON document.
  const documentStart = output.indexOf("{");
  if (documentStart === -1) {
    throw new Error("The `supabase status` output has no JSON document");
  }

  let status: unknown;
  try {
    status = JSON.parse(output.slice(documentStart));
  } catch (cause) {
    throw new Error("The `supabase status` output is not valid JSON", { cause });
  }

  if (
    !isRecord(status) ||
    typeof status["API_URL"] !== "string" ||
    typeof status["ANON_KEY"] !== "string" ||
    typeof status["SERVICE_ROLE_KEY"] !== "string"
  ) {
    throw new Error(
      "API_URL, ANON_KEY or SERVICE_ROLE_KEY is missing from the `supabase status` output",
    );
  }

  return {
    apiUrl: status["API_URL"],
    anonKey: status["ANON_KEY"],
    serviceRoleKey: status["SERVICE_ROLE_KEY"],
  };
}

/** Asks the CLI for the status of the stack that the Supabase project in `workdir` starts. */
export async function readSupabaseStatus(workdir: string): Promise<SupabaseStatus> {
  const { stdout } = await run("supabase", ["status", "--workdir", workdir, "--output", "json"], {
    timeout: 30_000,
  });
  return parseSupabaseStatus(stdout);
}
