import type { SetupMode } from "./types";

/**
 * The wizard's mode from the route's `mode` search parameter. Only an exact `first-run` is the first run,
 * so a mistyped or missing parameter opens the recalculation, which has Close and so can never trap the person.
 */
export function readSetupMode(parameter: string | string[] | undefined): SetupMode {
  return parameter === "first-run" ? "first-run" : "recalculate";
}
