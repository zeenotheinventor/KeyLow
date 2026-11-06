import type { Sex } from "@keylow/core/engine";

export type SexStepProps = {
  /** The chosen sex, or `undefined` when none is chosen yet. */
  value: Sex | undefined;
  onChange: (sex: Sex) => void;
};
