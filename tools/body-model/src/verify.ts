// pnpm --filter @keylow/body-model verify <file.glb>...
//
// Checks each glb against the asset contract and prints the problems. Exits 1 when any file has one.
import { register } from "node:module";

register("./resolveExtensionlessTypeScript.ts", import.meta.url);
// Imported after the hook is registered, because the contract reads the muscle ids from @keylow/core.
const { verifyGlbFile } = await import("./verifyGlb.ts");

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Pass at least one .glb file.");
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const problems = verifyGlbFile(file);
  if (problems.length === 0) {
    console.log(`${file}: ok`);
    continue;
  }
  failed = true;
  console.error(`${file}: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
}
process.exit(failed ? 1 : 0);
