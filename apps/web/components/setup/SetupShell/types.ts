import type { ReactNode, Ref } from "react";

export type SetupShellProps = {
  /** Names the step on show. Focus moves to the question when it changes. */
  stepKey: string;
  /** Above the bar: "About you · Step 1 of 8". */
  caption: string;
  /** The bar's accessible name: "Step 1 of 8". */
  progressName: string;
  /** How full the bar is, from 0 to 1, from core's `progressFraction`. */
  progressFraction: number;
  /** The question, in the h1. */
  question: string;
  /** The one helper line under the question. The estimate has none. */
  helper?: string | undefined;
  /** Back in the footer. Left out on the first step. */
  onBack?: (() => void) | undefined;
  /** Close in the footer, for a recalculation. Left out on the first run. */
  onClose?: (() => void) | undefined;
  /**
   * The footer's main button. `label` is Continue unless a step says otherwise (the estimate's is Start or Save
   * targets). `isLoading` shows the spinner and keeps the button inert.
   */
  continueAction: {
    isEnabled: boolean;
    onPress: () => void;
    label?: string;
    isLoading?: boolean;
    loadingLabel?: string;
  };
  /** Lets a screen put focus back on the main button after a failed save, since the press turned it off. */
  continueButtonRef?: Ref<HTMLButtonElement>;
  /**
   * The first run's one way out of step 1, left of Continue from 700 px and under it below, a ghost Button in the
   * secondary ink. It is the kit's busy Button while it runs. Left out everywhere else.
   */
  escapeAction?:
    | {
        label: string;
        onPress: () => void;
        isLoading: boolean;
      }
    | undefined;
  /** Lets a screen put focus back on the escape after a failed write, since the press turned it off. */
  escapeButtonRef?: Ref<HTMLButtonElement>;
  /** Back and Close are dimmed and inert, while a save runs. */
  isLeavingInert?: boolean | undefined;
  /** A banner above the buttons, such as the read's failure. */
  notice?: ReactNode;
  /** The step's answers. */
  children: ReactNode;
};
