import type { ReadOnlySetRowProps } from "../../SetRow";

/** A set of the card: the read-only row's props, with the key that keeps it in place. */
export type ReadOnlyExerciseCardRow = ReadOnlySetRowProps & {
  /** Keeps the row in place as the list changes: the logged set's id. */
  key: string;
};

export type ReadOnlyExerciseCardProps = {
  name: string;
  /** The note beside the name: "Bodyweight", "2 more than planned", both, or null for none. */
  note: string | null;
  rows: readonly ReadOnlyExerciseCardRow[];
};
