import type { ReactNode } from "react";

export type ScrollingResultsProps = {
  /** What the user has typed, untrimmed. A different search starts again from the first rows. */
  query: string;
  /** Draws the results with as many food rows as the list has revealed so far. */
  children: (
    visibleRowCount: number,
    /** Tells the list whether rows are left to reveal. Say false while the results are still on their way. */
    onMoreRowsChange: (hasMoreRows: boolean) => void,
  ) => ReactNode;
};
