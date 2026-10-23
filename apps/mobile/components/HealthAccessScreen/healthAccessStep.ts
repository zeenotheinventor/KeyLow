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

/**
 * Which state of the permissions flow the screen draws, from what the flow has learned so far. Weight is what
 * connected means: an import that ended well is `connected-partial` unless both body types are allowed, and
 * `denied` when weight access is gone, whatever the body result says.
 */
export function healthAccessStep(inputs: HealthAccessInputs): HealthAccessStep {
  const {
    availability,
    hasPermission,
    permissionAnswer,
    bodyCompositionAccess,
    mode,
    hasAskedBodyComposition,
    isImporting,
    importStatus,
  } = inputs;
  const hasEitherBodyType = bodyCompositionAccess.bodyFat || bodyCompositionAccess.leanMass;
  const hasBothBodyTypes = bodyCompositionAccess.bodyFat && bodyCompositionAccess.leanMass;

  if (importStatus !== null) {
    const step = stepOfImport[importStatus];
    return step === "connected" && !hasBothBodyTypes ? "connected-partial" : step;
  }
  if (availability === "needs-install") {
    return "install";
  }
  // The add-later flow needs weight to be held already. Without it the first-time flow runs.
  if (mode === "add-body-composition" && hasPermission) {
    if (!hasAskedBodyComposition) {
      return "explain-body-composition";
    }
    return hasEitherBodyType ? "connecting" : "denied-body-composition";
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
