import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

import { classifyDoctorRun, decideGateOutcome } from "./doctorGate.ts";

// The expo-doctor version is pinned in this package's package.json, so a new doctor release cannot turn
// CI red by itself. The classifier reads that version's report format. After raising the pin, capture
// the fixtures in test/fixtures again.
const doctorPackageDirectory = path.dirname(
  createRequire(import.meta.url).resolve("expo-doctor/package.json"),
);
const doctorBinary = path.join(doctorPackageDirectory, "bin", "expo-doctor.js");

// Run from apps/mobile. The shell merges stderr into stdout so the report keeps doctor's own order.
const doctor = spawnSync(`"${process.execPath}" "${doctorBinary}" 2>&1`, {
  shell: true,
  encoding: "utf8",
});
const output = doctor.stdout;
process.stdout.write(output);

const { exitCode, annotations } = decideGateOutcome(
  classifyDoctorRun({ exitCode: doctor.status, output }),
);
for (const annotation of annotations) {
  console.log(annotation);
}
process.exit(exitCode);
