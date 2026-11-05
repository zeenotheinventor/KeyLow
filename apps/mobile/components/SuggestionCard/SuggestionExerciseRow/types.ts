import type { SuggestionDetailRow } from "@keylow/core/copy";

export type SuggestionExerciseRowProps = {
  /** The exercise's words, all core's: its name, its target and where it came from. */
  row: SuggestionDetailRow;
  /** Every row but the first has a rule above it. */
  hasDivider: boolean;
};
