import type { TextInputProps } from "react-native";

export type TextAreaProps = Pick<
  TextInputProps,
  "value" | "onChangeText" | "onBlur" | "placeholder" | "autoFocus"
> & {
  /**
   * The field's accessible name, such as "Step 3 text". The field draws no label of its own, because it
   * sits under a title that says what it is for.
   */
  label: string;
  /** The count under the field's end, already written, such as "201 / 1,000". Draws nothing without it. */
  counter?: string | undefined;
  /** Writes the counter in danger, for text past its limit. The field does not stop typing. */
  isOverLimit?: boolean | undefined;
  /** One short sentence under the field's start that says what to do. Turns the border danger and is an alert. */
  error?: string | undefined;
  /** Drops the whole field to half strength and stops it taking typing. */
  disabled?: boolean | undefined;
};
