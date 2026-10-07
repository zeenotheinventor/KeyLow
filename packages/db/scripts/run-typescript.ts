// Runs a TypeScript script that imports @keylow/core, which Node cannot load directly because core's
// imports have no file extensions. esbuild bundles the script and core into one module, and everything
// else stays an import resolved from node_modules. The bundle goes into node_modules/.cache, which git ignores.
//
//   node --experimental-strip-types scripts/run-typescript.ts scripts/import-cofid.ts <script arguments>
import { mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

const [entry, ...scriptArguments] = process.argv.slice(2);
if (entry === undefined) {
  console.error("Usage: run-typescript.ts <script.ts> [arguments]");
  process.exit(2);
}

const packageDirectory = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(packageDirectory, "node_modules/.cache/keylow-db-scripts");
const outputFile = resolve(outputDirectory, `${basename(entry, ".ts")}.mjs`);
mkdirSync(outputDirectory, { recursive: true });

await build({
  entryPoints: [resolve(entry)],
  outfile: outputFile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: ["exceljs", "@supabase/supabase-js"],
  logLevel: "warning",
});

// The script reads its own arguments from process.argv, as if Node had run it directly.
process.argv = [process.argv[0] ?? "node", resolve(entry), ...scriptArguments];
await import(pathToFileURL(outputFile).href);
