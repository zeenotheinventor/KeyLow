import type { ProgressChange } from "@keylow/core/copy";

export type RoutineProgressRowProps = {
  /** The exercise's name. */
  name: string;
  /** The line under the name, already written by core: this week's value, or the last one when this week is a gap. */
  line: string;
  /** How this week moved. Drawn as a pill whose colour follows the direction, and the sign and words carry it as well. Nothing is drawn without it. */
  change: ProgressChange | null;
  /** The row said in full, for a screen reader. */
  accessibleName: string;
  /** The recent weeks for the sparkline, oldest first, a skipped week as `null`. No sparkline is drawn when no week was trained. */
  points: readonly (number | null)[];
  /** Opens the exercise's graph. The row is plain information without it. */
  onPress?: (() => void) | undefined;
};
