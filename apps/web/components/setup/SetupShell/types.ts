import type { ReactNode } from "react";

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
  /** The one helper line under the question. */
  helper: string;
  /** Back in the footer. Left out on the first step. */
  onBack?: (() => void) | undefined;
  /** Close in the footer, for a recalculation. Left out on the first run. */
  onClose?: (() => void) | undefined;
  continueAction: { isEnabled: boolean; onPress: () => void };
  /** A banner above the buttons, such as the read's failure. */
  notice?: ReactNode;
  /** The step's answers. */
  children: ReactNode;
};
