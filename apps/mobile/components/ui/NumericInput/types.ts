import type { FieldFrameProps, FieldMacro, FieldTextProps } from "../Input";

export type NumericInputMacro = FieldMacro;

/**
 * A number with its unit after it, such as the 165 of 165 kcal. Every one the food form boards draw is
 * `compact`, so that is its default, where `Input` defaults to `comfortable`.
 */
export type NumericInputProps = FieldFrameProps &
  FieldTextProps & {
    /** Shown after the value, such as g, kcal, kg or ml. The suffix is decoration, so the unit is also added to the field's name. */
    unit?: string | undefined;
    /** Puts the macro's colour beside the label, as the food form draws Protein, Carbohydrate and Fat. */
    macro?: NumericInputMacro | undefined;
    /** Shows a value the person cannot change, as `Input` does: the field sits on the surface, draws a lock and takes no typing. */
    locked?: boolean | undefined;
  };
