import type { LoadUnit } from "@keylow/core/training";

/** The text of a set's numbers as a form holds it. The RIR is the text of its number, which is what a chip stands for. */
export type TypedSet = Readonly<{ load: string; reps: string; rir: string }>;

export type SetNumbersFieldsProps = {
  /** The unit the person trains in: the load is typed and shown in it. */
  unit: LoadUnit;
  typed: TypedSet;
  /** The sentence for a rule the load breaks, shown once the field has been edited. */
  loadError: string | undefined;
  repsError: string | undefined;
  onChangeLoad: (load: string) => void;
  onChangeReps: (reps: string) => void;
  onChangeRir: (rir: string) => void;
  /** The line under the chips, or null for none. */
  rirHelp: string | null;
  /** A line between the numbers and the chips, such as where the numbers came from. Left out, none is drawn. */
  note?: string | null | undefined;
};
