/**
 * What a validator returns. A refusal names the fields that failed and why, and never carries the
 * values the person typed, because they are health data.
 */
export type ValidationResult<Value, Problems> =
  { ok: true; value: Value } | { ok: false; problems: Problems };

/** A number a person has entered. Null is a blank field, and NaN or infinity is not a number. */
export type EnteredNumber = number | null;

export type MacroField = "protein_g" | "fat_g" | "carbs_g";
export type MacroProblems = Partial<Record<MacroField, "negative" | "invalid">>;

const macroFields: readonly MacroField[] = ["protein_g", "fat_g", "carbs_g"];

export const isUsableNumber = (value: EnteredNumber): value is number =>
  value !== null && Number.isFinite(value);

/**
 * Macros are optional, so a blank is fine. A number that is entered must be finite (otherwise it is
 * `invalid`) and 0 or more (otherwise it is `negative`).
 */
export const findMacroProblems = (macros: Record<MacroField, EnteredNumber>): MacroProblems => {
  const problems: MacroProblems = {};
  for (const field of macroFields) {
    const value = macros[field];
    if (value === null) {
      continue;
    }
    if (!Number.isFinite(value)) {
      problems[field] = "invalid";
    } else if (value < 0) {
      problems[field] = "negative";
    }
  }
  return problems;
};
