import type { ProgrammeReads } from "../../useProgrammeReads";
import type { SetupMode } from "@/lib/setupRoutes";

export type EstimateStepProps = {
  /** The first run says Start and lands on the Diary. A recalculation says Save targets, has Close and returns to Targets. */
  mode: SetupMode;
  /** The reads a recalculation after a check-in keeps the measured expenditure from. */
  programme: ProgrammeReads;
};
