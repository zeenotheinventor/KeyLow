import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadBodyModel } from "../../src/loadBodyModel";

// Resolved through the package's `exports`, so the test reads the one committed copy the app bundles.
const maleGlbPath = fileURLToPath(import.meta.resolve("@keylow/body-model/male.glb"));

/** The committed male.glb, parsed with the same loader as the app. */
export function loadMaleBody() {
  const bytes = readFileSync(maleGlbPath);
  // Node hands out a view on a shared pool, so the glb is copied into a buffer of its own.
  return loadBodyModel(new Uint8Array(bytes).buffer);
}
