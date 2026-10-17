import type { ServingsStepperProps } from "../ui";

export type ServingsCardProps = Pick<
  ServingsStepperProps,
  | "text"
  | "onChangeText"
  | "valueText"
  | "canDecrease"
  | "canIncrease"
  | "onStep"
  | "error"
  | "fieldRef"
> & {
  /** Asked for when the servings field is left. */
  onBlur: () => void;
  /** The cooked weight for the chosen servings: "Makes 6 · 1,650 g cooked". */
  yieldLine: string;
  /** The Reset link's words, such as "Back to 4 servings", or null while the servings are the recipe's own. */
  resetLabel: string | null;
  onReset: () => void;
};
