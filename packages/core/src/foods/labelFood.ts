import { customFoodInputSchema } from "../schemas/food";

import type { CustomFoodInput } from "../schemas/food";

/*
 * A food as the person reads it off a label: "210 kcal, 20 g protein, 19 g carbs, 6 g fat per bar". The
 * database holds a food per 100 g with its portions, so a per portion label is scaled by the portion's
 * weight. The label's energy must agree with its macros before anything is saved, so a wrong number is
 * asked about and never stored.
 */

/** How far a label's kcal may be from 4 per gram of protein and carbs and 9 per gram of fat, as a fraction of that. */
export const LABEL_KCAL_TOLERANCE = 0.15;

export type LabelFoodValues = {
  name: string;
  brand: string | null;
  /** `per_100g` for a label per 100 g, `per_portion` for a label per bar, slice or cup. */
  per: "per_100g" | "per_portion";
  portion_label: string | null;
  portion_grams: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type LabelFoodResult =
  { ok: true; food: CustomFoodInput } | { ok: false; fields: string[]; macroKcal: number | null };

type Macros = Pick<LabelFoodValues, "protein_g" | "carbs_g" | "fat_g">;

/** The energy the macros make: 4 per gram of protein and of carbs, 9 per gram of fat. */
export const macroKcalOf = ({ protein_g, carbs_g, fat_g }: Macros): number =>
  4 * protein_g + 4 * carbs_g + 9 * fat_g;

const refused = (fields: string[], macroKcal: number | null = null): LabelFoodResult => ({
  ok: false,
  fields,
  macroKcal,
});

const roundedToHundredths = (value: number): number => Math.round(value * 100) / 100;

/**
 * The food a label describes, ready for `createFood`, or the fields that are wrong. A per portion label
 * needs its portion's label and weight and a per 100 g label needs neither. `macroKcal` is set when the
 * label's energy is more than `LABEL_KCAL_TOLERANCE` away from its macros, and is what they make. The
 * result is checked with the food form's own schema, so the form's limits apply.
 */
export function labelFoodInput(values: LabelFoodValues): LabelFoodResult {
  const { per, portion_label, portion_grams } = values;
  // A per portion label needs both, and a per 100 g label must send neither.
  const missing = [
    ...(portion_label === null ? ["portion_label"] : []),
    ...(portion_grams === null ? ["portion_grams"] : []),
  ];
  const surplus = [
    ...(portion_label === null ? [] : ["portion_label"]),
    ...(portion_grams === null ? [] : ["portion_grams"]),
  ];
  const wrongPortionFields = per === "per_portion" ? missing : surplus;
  if (wrongPortionFields.length > 0) {
    return refused(wrongPortionFields);
  }

  const macroKcal = macroKcalOf(values);
  if (Math.abs(values.kcal - macroKcal) > LABEL_KCAL_TOLERANCE * macroKcal) {
    return refused(["kcal"], macroKcal);
  }

  // A per 100 g label is stored as it is. A per portion label is scaled to 100 g by the portion's weight.
  const scale = per === "per_portion" && portion_grams !== null ? 100 / portion_grams : 1;
  const parsed = customFoodInputSchema.safeParse({
    name: values.name,
    ...(values.brand === null ? {} : { brand: values.brand }),
    basis: "per_100g",
    kcal: roundedToHundredths(values.kcal * scale),
    protein_g: roundedToHundredths(values.protein_g * scale),
    carbs_g: roundedToHundredths(values.carbs_g * scale),
    fat_g: roundedToHundredths(values.fat_g * scale),
    portions:
      per === "per_portion" && portion_label !== null && portion_grams !== null
        ? [{ label: portion_label, grams: portion_grams, isDefault: true }]
        : [],
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => String(issue.path[0] ?? "name"));
    return refused([...new Set(fields)]);
  }
  return { ok: true, food: parsed.data };
}
