import { readFileSync } from "node:fs";

const envFile = new URL("../../../supabase/functions/.env.test", import.meta.url);

/**
 * The values `supabase functions serve` runs with. Tests read the same file, so a test's idea of the
 * User-Agent or a rate limit can never differ from the function's.
 */
export function readFunctionEnvironment(): Record<string, string> {
  const lines = readFileSync(envFile, "utf8").split("\n");
  const pairs = lines.flatMap((line): [string, string][] => {
    const separator = line.indexOf("=");
    return line.startsWith("#") || separator === -1
      ? []
      : [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()]];
  });
  return Object.fromEntries(pairs);
}

/** One variable from the file, or a failure that names it. */
export function requireFunctionEnvironmentValue(name: string): string {
  const value = readFunctionEnvironment()[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set in supabase/functions/.env.test`);
  }
  return value;
}
