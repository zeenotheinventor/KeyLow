import type { InputProps } from "../types";

export type FieldMacro = "protein" | "carbs" | "fat";

/** The one field `Input` and `NumericInput` both are: the same box, label and messages. */
export type TextFieldProps = InputProps & {
  /** Shown after the value in muted text, such as g or kcal. It is decoration, so it joins the field's name. */
  unit?: string | undefined;
  /** Puts the macro's colour beside the label. */
  macro?: FieldMacro | undefined;
  /** Defaults to `left`. */
  align?: "left" | "right";
};
