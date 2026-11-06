import type { SetupMode } from "@/lib/setupRoutes";
import type { SetupStep } from "@keylow/core/setup";

export type SetupScreenProps = {
  /** The step the address names. The address is the source of truth, so the screen draws this one. */
  step: SetupStep;
  mode: SetupMode;
};
