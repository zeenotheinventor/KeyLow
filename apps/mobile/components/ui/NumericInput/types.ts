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
    /** Defaults to `right`. The servings stepper centres its number. `left` puts the digits at the start with the unit at the far end, as the weigh-in sheet's weight is drawn. */
    align?: "left" | "right" | "center" | undefined;
    /**
     * Defaults to the decimal pad. A count of whole things asks for the number pad, which has no decimal key.
     * A range such as the reps "8 to 12" asks for the punctuation keyboard, which has the hyphen and the space.
     */
    keyboardType?: "decimal-pad" | "number-pad" | "numbers-and-punctuation" | undefined;
    /**
     * `display` is a 32 point number in a box 64 points high, as the set entry boards draw the load and the reps.
     * `cell` is a box 36 points high with no padding across, as the routine editor board draws the sets, reps
     * and RIR of an exercise. Defaults to `default`.
     */
    size?: "default" | "display" | "cell" | undefined;
    /** Sets the value in strong body text. Defaults to regular. */
    strongValue?: boolean | undefined;
    /** Makes the field an adjustable that a swipe steps up and down. */
    adjustable?: FieldAdjustment | undefined;
  };
