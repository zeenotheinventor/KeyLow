import type { FieldAdjustment, InputProps } from "../types";

export type FieldMacro = "protein" | "carbs" | "fat";

/** The one field `Input` and `NumericInput` both are: the same box, label and messages. */
export type TextFieldProps = InputProps & {
  /** Shown after the value in muted text, such as g or kcal. It is decoration, so it joins the field's name. */
  unit?: string | undefined;
  /** Puts the macro's colour beside the label. */
  macro?: FieldMacro | undefined;
  /** Defaults to `left`. */
  align?: "left" | "right" | "center";
  /**
   * `display` is a large centred number in a taller box, as the set entry boards draw the load and the reps.
   * `cell` is a box 36 points high with no padding across, for the numbers of a row in a table, as the
   * routine editor board draws the sets, reps and RIR of an exercise. `sm` is a box 36 points high with 10
   * points across, for a field inside a row, as the plate row draws its amount. Defaults to `default`.
   */
  size?: "default" | "display" | "cell" | "sm" | undefined;
  /** Sets the value in strong body text, as the servings stepper's number is. Defaults to regular. */
  strongValue?: boolean | undefined;
  /** Makes the field an adjustable that a swipe steps up and down. */
  adjustable?: FieldAdjustment | undefined;
};
