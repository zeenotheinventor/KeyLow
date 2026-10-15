import { FOOD_FORM, describeNutritionHeading } from "@keylow/core/copy";
import { REQUIRED_FOOD_NUTRIENTS } from "@keylow/core/foods";
import { nutrientBasisSchema } from "@keylow/core/schemas";
import { useId } from "react";

import { DENSE_FRAME_CLASS_NAME } from "../denseField";

import type { NutrientField, NutritionCardProps } from "./types";
import type { NumericInputMacro } from "@/components/ui/NumericInput";

import { Card } from "@/components/ui/Card";
import { NumericInput } from "@/components/ui/NumericInput";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

type NutrientFieldConfig = {
  nutrient: NutrientField;
  unit: string;
  macro?: NumericInputMacro;
};

// In the order the boards draw them. Carbohydrate comes before fat, as on the detail screen.
const NUTRIENT_FIELDS: readonly NutrientFieldConfig[] = [
  { nutrient: "kcal", unit: "kcal" },
  { nutrient: "protein_g", unit: "g", macro: "protein" },
  { nutrient: "carbs_g", unit: "g", macro: "carbs" },
  { nutrient: "fat_g", unit: "g", macro: "fat" },
  { nutrient: "fibre_g", unit: "g" },
];

const REQUIRED_NUTRIENTS: ReadonlySet<NutrientField> = new Set(REQUIRED_FOOD_NUTRIENTS);

const BASIS_OPTIONS = nutrientBasisSchema.options.map((basis) => ({
  value: basis,
  label: FOOD_FORM.basisOptions[basis],
}));

/** The basis, then each nutrient. Fibre is the only one that may be left blank. */
export function NutritionCard({
  basis,
  values,
  errors,
  notGiven,
  hasUsCarbsNote,
  onBasisChange,
  onChange,
}: NutritionCardProps) {
  const headingId = useId();
  const noteIdPrefix = useId();

  return (
    <Card asChild className="flex flex-col gap-3 shadow-none">
      <section aria-labelledby={headingId}>
        <div className="flex flex-col gap-0.5">
          <h2 id={headingId} className="text-body-strong">
            {describeNutritionHeading(basis)}
          </h2>
          <span className="text-caption text-text-muted">{FOOD_FORM.nutritionNote}</span>
          {hasUsCarbsNote && (
            <span className="mt-1 text-caption text-text-secondary">{FOOD_FORM.usCarbsNote}</span>
          )}
        </div>
        <SegmentedControl
          label={FOOD_FORM.basis}
          options={BASIS_OPTIONS}
          value={basis}
          onChange={onBasisChange}
          className="max-w-[320px]"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {NUTRIENT_FIELDS.map(({ nutrient, unit, macro }) => {
            const error = errors[nutrient];
            const noteId = `${noteIdPrefix}-${nutrient}`;
            const isNotGiven =
              notGiven.includes(nutrient) && values[nutrient] === "" && error === undefined;

            return (
              <div key={nutrient} className="flex min-w-0 flex-col gap-1">
                <NumericInput
                  label={FOOD_FORM.nutrients[nutrient]}
                  unit={unit}
                  macro={macro}
                  aria-required={REQUIRED_NUTRIENTS.has(nutrient) ? "true" : undefined}
                  frameClassName={DENSE_FRAME_CLASS_NAME}
                  value={values[nutrient]}
                  onChange={(event) => {
                    onChange(nutrient, event.target.value);
                  }}
                  error={error}
                  describedBy={isNotGiven ? noteId : undefined}
                />
                {isNotGiven && (
                  <span
                    id={noteId}
                    className="text-caption text-warning light-theme:text-text-primary"
                  >
                    {FOOD_FORM.notGivenBySource}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </Card>
  );
}
