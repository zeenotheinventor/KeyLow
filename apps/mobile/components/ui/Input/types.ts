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
  /**
   * Names the field for a screen reader in place of the visible label, whole: a `NumericInput` does not add
   * its unit to it. For a field whose visible label does not tell it apart from another, such as each
   * portion's amount. Defaults to the label.
   */
  accessibilityLabel?: string | undefined;
  /**
   * Draws no visible label, for a field whose label sits beside it on the screen, as the servings
   * stepper's does. The label is still the field's accessible name.
   */
  labelHidden?: boolean | undefined;
  /** A short note at the end of the label's line, such as "Required". */
  labelHint?: string | undefined;
  /**
   * Says a screen reader should announce the field as required, for a field whose "Required" is not drawn,
   * such as the nutrients, which a note above them covers. It is read as the first part of the field's hint,
   * so the field's name is unchanged, and it gives way to an error, which says so itself. Draws nothing.
   */
  required?: boolean | undefined;
  /** One short sentence under the field. An error replaces it. */
  helper?: string | undefined;
  /**
   * Draws the helper as a warning, with a warning triangle before it and the words in the warning ink, for a
   * note that asks the person to look again, such as macros that do not add up to the calories. It is
   * information only: the field stays valid. An error replaces it, and it draws nothing without a helper.
   */
  helperTone?: "warning" | undefined;
  /** Says what to do. Turns the border danger and is announced as an alert. Replaces the helper. */
  error?: string | undefined;
  /**
   * Says the screen draws the error's message itself, as the food form draws a portion's amount error
   * across the whole row. The field keeps the danger border and still describes itself by the error,
   * so a screen reader reads it with the field, but it draws no message of its own and the screen draws
   * the alert. Does nothing while there is no error.
   */
  errorShownElsewhere?: boolean | undefined;
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

/**
 * Makes a field an adjustable for a screen reader, which steps its value up and down with a swipe, as the
 * buttons beside it do. The field holds no rules: the caller decides what a step does.
 */
export type FieldAdjustment = {
  /** What a screen reader reads as the field's value, such as "6 servings". */
  valueText: string;
  /** Asked for on a swipe up (1) or a swipe down (-1). */
  onStep: (direction: 1 | -1) => void;
};

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
