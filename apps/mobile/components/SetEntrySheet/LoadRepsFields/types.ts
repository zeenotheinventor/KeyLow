import type { LoadUnit } from "@keylow/core/training";

export type LoadRepsFieldsProps = {
  /** The unit the load is typed and shown in. */
  unit: LoadUnit;
  /** The text of each field. */
  load: string;
  reps: string;
  /** The sentence that states the rule a field breaks, when it breaks one and has been edited. */
  loadError: string | undefined;
  repsError: string | undefined;
  onChangeLoad: (text: string) => void;
  onChangeReps: (text: string) => void;
};
