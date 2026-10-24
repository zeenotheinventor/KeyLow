import type { DietStyle } from "@keylow/core/setup";

export type DietStepProps = {
  /** The chosen style. Balanced is chosen on arrival. */
  value: DietStyle | undefined;
  onChange: (dietStyle: DietStyle) => void;
};
