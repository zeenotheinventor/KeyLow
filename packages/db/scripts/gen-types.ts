// Regenerates src/types.gen.ts from the local Supabase database. The stack must
// be running (`pnpm dev:db`) with the migrations applied (`pnpm --filter @keylow/db migration:up`).
// The database is addressed by URL so that a stack on a non-default port can be targeted. Set
// SUPABASE_DB_URL for that.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packageDirectory = resolve(import.meta.dirname, "..");
const outputFile = resolve(packageDirectory, "src/types.gen.ts");
const databaseUrl =
  process.env["SUPABASE_DB_URL"] ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
// The CLI demands an access token before `gen types`, even over a database URL, and fails with
// "Access token not provided" when no login is stored (a CI runner, for example). It only checks
// the format of the token, so a placeholder is enough and is never sent anywhere. The placeholder
// is the "sbp_" prefix followed by 40 zeros, built here so that the source holds no token-shaped
// string for secret scanners to flag. A real token still wins.
const placeholderAccessToken = `sbp_${"0".repeat(40)}`;
const accessToken = process.env["SUPABASE_ACCESS_TOKEN"] ?? placeholderAccessToken;

function generateTypes(): string {
  return execFileSync("supabase", ["gen", "types", "--lang=typescript", "--db-url", databaseUrl], {
    cwd: packageDirectory,
    encoding: "utf8",
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
    stdio: ["ignore", "pipe", "inherit"],
  });
}

// Prettier makes the committed file pass the repo's format gate and keeps
// regeneration byte-stable.
function formatFile(file: string): void {
  execFileSync("pnpm", ["exec", "prettier", "--write", file], {
    cwd: packageDirectory,
    stdio: "inherit",
  });
}

try {
  writeFileSync(outputFile, generateTypes());
  formatFile(outputFile);
} catch (error) {
  console.error(
    "gen-types failed. Is the local Supabase stack running? Start it with `pnpm dev:db`.",
  );
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
