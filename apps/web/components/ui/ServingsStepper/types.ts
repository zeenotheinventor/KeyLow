import type { Ref } from "react";

/** Which way a step goes: `1` for one more serving, `-1` for one fewer. */
export type ServingsStepDirection = -1 | 1;

export type ServingsStepperProps = {
  /** The name of the field, such as "Servings". It is drawn on the left and read as the field's name. */
  label: string;
  /** The name of the minus button, such as "Fewer servings". */
  decreaseLabel: string;
  /** The name of the plus button, such as "More servings". */
  increaseLabel: string;
  /** What the field holds, even when it is not a number. */
  text: string;
  /** Asked for when the text changes, with the new text. */
  onChangeText: (text: string) => void;
  /** The last good number, which a screen reader hears as the field's value while the text is wrong. */
  value: number;
  /** The value spoken, such as "6 servings". */
  valueText: string;
  /** Whether the minus button can act. Off, it is dimmed, says it is disabled and does nothing. */
  canDecrease: boolean;
  /** Whether the plus button can act. Off, it is dimmed, says it is disabled and does nothing. */
  canIncrease: boolean;
  /** Asked for when a button is pressed, or ArrowUp or ArrowDown in the field, if that step can act. */
  onStep: (direction: ServingsStepDirection) => void;
  /** One sentence under the row, tied to the field. It flags the field with the danger border and is announced. */
  error?: string | undefined;
  /** Asked for when focus leaves the field. */
  onBlur?: (() => void) | undefined;
  /** Makes the whole control inert: the field and both buttons. */
  disabled?: boolean | undefined;
  /** Gives the field to a screen that moves focus to it, such as after a reset. */
  fieldRef?: Ref<HTMLInputElement>;
};
