import type { FieldAdjustment, FieldFrameProps, FieldMacro, FieldTextProps } from "../Input";

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
    /** Defaults to `right`. The servings stepper centres its number. */
    align?: "right" | "center" | undefined;
    /** Defaults to the decimal pad. A count of whole things asks for the number pad, which has no decimal key. */
    keyboardType?: "decimal-pad" | "number-pad" | undefined;
    /** Sets the value in strong body text. Defaults to regular. */
    strongValue?: boolean | undefined;
    /** Makes the field an adjustable that a swipe steps up and down. */
    adjustable?: FieldAdjustment | undefined;
  };
