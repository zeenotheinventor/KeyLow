import type { SetupReadFailure } from "../useSetupRead";
import type { SetupState } from "@keylow/api-client";
import type { SetupWizardAction, SetupWizardState } from "@keylow/core/setup";
import type { WeightDisplayUnit } from "@keylow/core/weight";
import type { Dispatch, ReactNode } from "react";

export type SetupFlowProps = { children: ReactNode };

export type SetupFlowValue = Readonly<{
  state: SetupWizardState;
  dispatch: Dispatch<SetupWizardAction>;
  /** Today as `YYYY-MM-DD` in the device's time zone. */
  today: string;
  /** The unit the body fields show: the draft's, or the stored unit's, or the device region's before the answers arrive. */
  weightUnit: WeightDisplayUnit;
  /**
   * Whether an address can be judged: the saved answers have joined the draft, or the read has ended with
   * none to come, so a recalculation is not sent back to the first step before its answers arrive.
   */
  isAddressJudgeable: boolean;
  /**
   * The saved setup as read, or undefined while it is not known: pending, paused offline or failed. A save is
   * held on this being there, because without it the stored weight unit and the latest weigh-in are unknown.
   */
  setupState: SetupState | undefined;
  /** The saved answers could not be read. The steps stay usable, with a banner and Try again. */
  readFailure: SetupReadFailure | undefined;
}>;
