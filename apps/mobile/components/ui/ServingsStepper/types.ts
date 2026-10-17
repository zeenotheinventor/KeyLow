export type ServingsStepperProps = {
  /** The label on the left of the row, such as "Servings". It is also the field's accessible name. */
  label: string;
  /** The name of the button that steps down, such as "Fewer servings". */
  decreaseLabel: string;
  /** The name of the button that steps up, such as "More servings". */
  increaseLabel: string;
  /** The field's text. The caller keeps it, so it can hold what is typed before it is a valid number. */
  text: string;
  /** What a screen reader reads as the field's value, such as "6 servings". */
  valueText: string;
  onChangeText: (text: string) => void;
  /** Asked for by a button, or by a swipe up (1) or down (-1) on the field. The stepper does not clamp. */
  onStep: (direction: 1 | -1) => void;
  /** Whether the step down button can act. A button that cannot is dimmed and disabled. */
  canDecrease: boolean;
  /** Whether the step up button can act. A button that cannot is dimmed and disabled. */
  canIncrease: boolean;
  /** One sentence under the row, right aligned, that turns the field's border to danger. */
  error?: string | undefined;
  /** Asked for when the field is left. */
  onBlur?: () => void;
  /** Disables the buttons and the field as a whole. */
  disabled?: boolean;
  /** Layout from the caller, such as margins. */
  className?: string;
};
