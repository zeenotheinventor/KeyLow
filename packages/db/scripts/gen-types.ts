// Regenerates src/types.gen.ts from the local Supabase database. The stack must
// be running (`pnpm dev:db`) with the migrations applied (`pnpm --filter @keylow/db db:reset`).
// The database is addressed by URL because `--local` makes some CLI setups ask for an access
// token, and a URL needs none. Set SUPABASE_DB_URL when the stack does not use the default port.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const packageDirectory = resolve(import.meta.dirname, "..");
const outputFile = resolve(packageDirectory, "src/types.gen.ts");
const databaseUrl =
  process.env["SUPABASE_DB_URL"] ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function generateTypes(): string {
  return execFileSync("supabase", ["gen", "types", "--lang=typescript", "--db-url", databaseUrl], {
    cwd: packageDirectory,
    encoding: "utf8",
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
