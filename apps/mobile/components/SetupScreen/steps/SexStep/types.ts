import type { Sex } from "@keylow/core/engine";

export type SexStepProps = {
  /** The chosen sex, or `undefined` while nothing is chosen. */
  value: Sex | undefined;
  onChange: (sex: Sex) => void;
};
