import type { TextFieldProps } from "@/components/ui/Input";

export type NumericInputMacro = "protein" | "carbs" | "fat";

export type NumericInputProps = Omit<TextFieldProps, "type" | "inputMode"> & {
  /** The keyboard a phone offers. It defaults to `decimal`; use `numeric` for whole numbers. */
  inputMode?: "decimal" | "numeric" | undefined;
  /** Keeps the label for a screen reader and takes it off the screen, for a field whose visible name sits elsewhere, such as a row's own label. */
  hideLabel?: boolean | undefined;
  /** Shown after the value, such as g, kcal, kg or ml. The suffix is a decoration, so the unit is also added to the field's name for a screen reader. */
  unit?: string;
  /** Puts the macro's colour beside the label, as the food form draws Protein, Carbohydrate and Fat. */
  macro?: NumericInputMacro | undefined;
  /** Classes for the box around the input, such as `gap-1.5 px-3` for a denser form. `className` still styles the input. */
  frameClassName?: string | undefined;
};
