import type { ServingsStepperProps } from "@/components/ui/ServingsStepper";
import type { Ref } from "react";

export type ServingsCardProps = Pick<
  ServingsStepperProps,
  | "text"
  | "onChangeText"
  | "value"
  | "valueText"
  | "canDecrease"
  | "canIncrease"
  | "onStep"
  | "error"
  | "onBlur"
> & {
  /** The servings field, for the screen that moves focus to it. */
  fieldRef: Ref<HTMLInputElement>;
  /** The cooked weight for the chosen servings: "Makes 6 · 1,650 g cooked". */
  yieldLine: string;
  /** The Reset link's words, such as "Back to 4 servings", or null while the servings are the recipe's own. */
  resetLabel: string | null;
  onReset: () => void;
};
