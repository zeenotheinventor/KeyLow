import type { TextInputProps } from "react-native";

/**
 * How much room the field's box gives its contents. `comfortable` is the design system card's, with 16
 * points either side, as the sign in boards draw it. `compact` is the food form boards', with 12.
 */
export type InputDensity = "comfortable" | "compact";

/** What every field draws around its control: a label, and one message under it. */
export type FieldFrameProps = {
  /** The visible label, and the field's accessible name. Short, sentence case. */
  label: string;
  /** A short note at the end of the label's line, such as "Required". */
  labelHint?: string | undefined;
  /** One short sentence under the field. An error replaces it. */
  helper?: string | undefined;
  /** Says what to do. Turns the border danger and is announced as an alert. Replaces the helper. */
  error?: string | undefined;
  /**
   * Says the value is not given, drawn under the field with a warning icon, as the copy forms draw it
   * for a nutrient the source leaves out. An error replaces it.
   */
  missingNote?: string | undefined;
  /** Drops the whole field to half strength and stops it taking typing. */
  disabled?: boolean | undefined;
  /** Defaults to `comfortable`, and to `compact` for a `NumericInput`. */
  density?: InputDensity | undefined;
};

/** What a field hands on to its text input. Only what a screen has needed so far. */
export type FieldTextProps = Pick<
  TextInputProps,
  | "value"
  | "onChangeText"
  | "onBlur"
  | "onSubmitEditing"
  | "placeholder"
  | "autoFocus"
  | "maxLength"
  | "returnKeyType"
>;

export type InputProps = FieldFrameProps &
  FieldTextProps &
  Pick<
    TextInputProps,
    | "autoCapitalize"
    | "autoComplete"
    | "autoCorrect"
    | "keyboardType"
    | "secureTextEntry"
    | "textContentType"
  > & {
    /**
     * Shows a value the person cannot change, such as the barcode a scan carried over: the field sits on
     * the surface, draws a lock at its end and takes no typing. Unlike `disabled` it keeps full strength.
     */
    locked?: boolean | undefined;
  };
