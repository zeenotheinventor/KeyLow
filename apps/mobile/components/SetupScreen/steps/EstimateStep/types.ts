import type { SetupMode } from "../../types";
import type { SetupAnswers, StartingPlan } from "@keylow/core/setup";

export type EstimateStepProps = {
  /** The complete answers, which the rate line and the guardrail lines read their weight, unit and rate from. */
  answers: SetupAnswers;
  /** What `startingPlan` made of those answers, or the plan after a check-in. Every figure on the screen is read from it. */
  plan: StartingPlan;
  /**
   * Set when the plan comes from the expenditure a check-in left, which a recalculation then keeps. Undefined
   * for the first run and for a settling recalculation, whose estimate restarts from the new answers.
   */
  measurement?: EstimateMeasurement | undefined;
  /** The first run says Start, and a recalculation says Save targets and has Close. */
  mode: SetupMode;
  /** Start or Save targets. Pressing it again after a failed save is the retry. */
  onStart: () => void;
  /** Whether the save is under way: the button shows its spinner and Back and Close are dimmed. */
  isSaving: boolean;
  /** Whether the last save failed: the error banner shows above the button. */
  saveFailed: boolean;
  /** Whether the app cannot reach the server: the offline banner shows and the button is dimmed. */
  isOffline: boolean;
  /**
   * Whether a recalculation is still reading the programme it keeps the expenditure of: the button is dimmed
   * as it is offline, because the figures on the screen are not the ones the save will make yet.
   */
  isWaitingForProgramme?: boolean | undefined;
  onBack: () => void;
  /** Close at the right of the header, which only a recalculation has. */
  onClose?: (() => void) | undefined;
};

/**
 * Where the expenditure of a plan after a check-in came from: a check-in measured it (on the date given,
 * `YYYY-MM-DD`), or none has and the estimate from the last check-in is carried forward.
 */
export type EstimateMeasurement =
  Readonly<{ kind: "measured"; measuredOn: string }> | Readonly<{ kind: "carried-forward" }>;

/** The words under the calorie numeral: the rate line, or the guardrail lines that replace it. */
export type EstimateLines = Readonly<{
  /** What the chosen rate is worth a week. Undefined when a guardrail changed the result. */
  rateLine: string | undefined;
  /** The line of the guardrail that set the calories, then the macro fit line when it applies. */
  guardrailLines: readonly string[];
}>;
