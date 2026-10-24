import type { ReactNode } from "react";

export type SetupShellProps = {
  /** The group the step belongs to, such as "About you". */
  title: string;
  /** "Step 1 of 8", under the title. The estimate has none. */
  subtitle: string | undefined;
  /** What a screen reader calls the progress bar. */
  progressName: string;
  /** How full the bar is, from 0 to 100. */
  progressPercent: number;
  /** The step's question, in the h1. A step that is not built yet has none. */
  question?: string | undefined;
  /** The one helper line under the question. */
  helper?: string | undefined;
  /** Back at the left of the header. Left out on the first step. */
  onBack?: (() => void) | undefined;
  /** Close at the right of the header, which only a recalculation has. */
  onClose?: (() => void) | undefined;
  /** Dims Back and Close and stops them responding, while the estimate is being saved. */
  isHeaderInert?: boolean | undefined;
  /** The footer's Continue. Left out, and with no `footer`, the step has no footer. */
  continueAction?: Readonly<{ isEnabled: boolean; onPress: () => void }> | undefined;
  /** A footer of the step's own, drawn in place of Continue, such as the estimate's banners and Start. */
  footer?: ReactNode;
  /** The step's controls, which scroll under the fixed header and above the fixed footer. */
  children?: ReactNode;
};
