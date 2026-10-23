import type { HealthAccessInputs, HealthAccessStep } from "./types";
import type { HealthImportStatus } from "../../lib/health";

// An import that ends without access taken away or a fault is connected. An `unavailable` import is an error
// too, because a retry works once the runner or the time zone is ready.
const stepOfImport: Record<HealthImportStatus, HealthAccessStep> = {
  imported: "connected",
  "nothing-new": "connected",
  "no-permission": "denied",
  failed: "import-error",
  unavailable: "import-error",
};

/** Which state of the permissions flow the screen draws, from what the flow has learned so far. */
export function healthAccessStep(inputs: HealthAccessInputs): HealthAccessStep {
  const { availability, hasPermission, permissionAnswer, isImporting, importStatus } = inputs;

  if (importStatus !== null) {
    return stepOfImport[importStatus];
  }
  if (availability === "needs-install") {
    return "install";
  }
  if (permissionAnswer === "denied") {
    return "denied";
  }
  // A grant is followed by an import at once, so the state does not wait for the running flag to move.
  if (permissionAnswer === "granted" || (hasPermission && isImporting)) {
    return "connecting";
  }
  return "explain";
}
