// pnpm --filter @keylow/body-model export --work <scratch folder>
//
// Runs blender/zanatomy_export.py, which decimates the body and writes male-raw.glb in the scratch folder, then
// quantises that file into dist/male.glb. Blender's exporter has no quantisation of its own.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { finishMaleExport, readRawGlb, removeStaleRawGlb } from "./maleExport.ts";
import { runBlender } from "./runBlender.ts";

const packageFolder = join(import.meta.dirname, "..");

function workFolder(args: string[]): string | undefined {
  const index = args.findIndex(
    (argument) => argument === "--work" || argument.startsWith("--work="),
  );
  const argument = args[index];
  if (argument === undefined) {
    return undefined;
  }
  return argument.startsWith("--work=") ? argument.slice("--work=".length) : args[index + 1];
}

function muscleIdsFromMap(): string[] {
  const mapping: unknown = JSON.parse(
    readFileSync(join(packageFolder, "muscles", "male", "zanatomy-map.json"), "utf8"),
  );
  if (typeof mapping !== "object" || mapping === null || !("ids" in mapping)) {
    throw new Error("zanatomy-map.json has no ids.");
  }
  const { ids } = mapping;
  if (typeof ids !== "object" || ids === null) {
    throw new Error("zanatomy-map.json has no ids.");
  }
  return Object.keys(ids);
}

const args = process.argv.slice(2);
const work = workFolder(args);
if (!work) {
  console.error("Pass --work <scratch folder outside the repository>.");
  process.exit(2);
}

removeStaleRawGlb(work);
const started = Date.now();
const exitCode = runBlender("zanatomy_export", args);
if (exitCode !== 0) {
  process.exit(exitCode);
}
const male = finishMaleExport(readRawGlb(work), muscleIdsFromMap());
mkdirSync(join(packageFolder, "dist"), { recursive: true });
writeFileSync(join(packageFolder, "dist", "male.glb"), male);
const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `dist/male.glb: ${(male.length / 1024).toFixed(0)} KB, sha256 ${createHash("sha256").update(male).digest("hex")}, export time ${seconds} s`,
);
