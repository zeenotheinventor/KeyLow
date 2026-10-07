import type { TextInputProps } from "react-native";

export type FormFieldProps = Pick<
  TextInputProps,
  "value" | "onChangeText" | "editable" | "keyboardType" | "autoCapitalize" | "autoCorrect"
> & {
  /** Shown above the input. */
  label: string;
  /** Names the input for assistive technology. Defaults to the label. */
  accessibilityLabel?: string;
  /** The validation error. It is announced as an alert and attached to the input as its hint. */
  error?: string | undefined;
  /** Guidance shown under the input while there is no error. */
  hint?: string;
};
