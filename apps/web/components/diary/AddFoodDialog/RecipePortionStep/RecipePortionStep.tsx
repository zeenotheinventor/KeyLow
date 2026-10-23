import {
  DIARY_PROBLEMS,
  FOOD_NUTRIENT_LABELS,
  PORTION_PICKER,
  RECIPE_BADGE,
  RECIPE_UNITS,
  SAVE_FAILED_BANNER,
  describeRawGramsNote,
  describeRecipeAmountBasis,
  describeRecipePer100Heading,
  describeRecipeYield,
  describeServingSuffix,
  nutrientRows,
} from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Info } from "lucide-react";
import { useId } from "react";

import { BackToResults } from "../BackToResults";

import type { RecipePortionStepProps } from "./types";
import type { RecipeEntryUnit } from "@keylow/core/diary";

import { MacroHero } from "@/components/foods/FoodDetail/MacroHero";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { NumericInput } from "@/components/ui/NumericInput";
import { NutrientTable } from "@/components/ui/NutrientTable";
import { TimeField } from "@/components/ui/TimeField";

// The two chips of a recipe, a number of servings first because it is the recipe's own unit.
const UNIT_OPTIONS: readonly { value: RecipeEntryUnit; label: string }[] = [
  { value: "serving", label: RECIPE_UNITS.serving },
  { value: "g", label: RECIPE_UNITS.grams },
];

/**
 * The add dialog's amount step for a recipe, as the web diary's recipe boards draw it: a Results link, the
 * Recipe badge with what the recipe makes, what the chosen amount comes to in the hero, the recipe's values
 * per 100 g, the amount with its unit chips, and the Time field. Every figure and sentence is core's, worked
 * out from the recipe's `computed` cache, so the hero is what the entry stores. A recipe with no cooked
 * weight says so under the hero when grams are chosen, because those grams are of the raw ingredients.
 */
export function RecipePortionStep({
  draft,
  time,
  isNow,
  onTimeChange,
  onBack,
  amountRef,
}: RecipePortionStepProps) {
  const noteId = useId();
  const { recipe, unit, typed } = draft;
  const { servings, yield_grams: yieldGrams } = recipe;
  // Grams of a recipe with no cooked weight are of the raw ingredients, which the step says.
  const isRawGrams = yieldGrams === null && unit === "g";
  const caption =
    typed === null
      ? PORTION_PICKER.noAmountBasis
      : describeRecipeAmountBasis({
          unit,
          quantity: typed.amount.quantity,
          resolvedGrams: typed.resolvedGrams,
        });
  const unitSuffix =
    unit === "g" ? RECIPE_UNITS.grams : describeServingSuffix(typed?.amount.quantity ?? 1);
  // The fibre row is a food's: a recipe's per 100 g is energy and the three macros.
  const per100Rows = nutrientRows(recipe.computed.per100g).filter(
    (row) => row.label !== FOOD_NUTRIENT_LABELS.fibre,
  );

  return (
    <>
      <BackToResults onClick={onBack} />
      {draft.hasSaveError && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-border">{RECIPE_BADGE}</Badge>
        <span className="text-caption tabular-nums text-text-secondary">
          {describeRecipeYield(servings, yieldGrams)}
        </span>
      </div>
      <MacroHero
        amount={{
          name: recipe.name,
          caption,
          values: typed?.values ?? null,
          describedBy: isRawGrams ? noteId : undefined,
        }}
      />
      {isRawGrams && (
        <p id={noteId} className="flex items-start gap-2 text-caption text-text-secondary">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={iconStroke} />
          {describeRawGramsNote(recipe.computed.effectiveGrams)}
        </p>
      )}
      <NutrientTable caption={describeRecipePer100Heading(yieldGrams)} rows={per100Rows} />
      <div className="grid items-end gap-3 min-[700px]:grid-cols-[160px_1fr]">
        <NumericInput
          ref={amountRef}
          label={PORTION_PICKER.amountLabel}
          unit={unitSuffix}
          value={draft.quantityText}
          error={typed === null ? DIARY_PROBLEMS.quantity : undefined}
          onChange={(event) => {
            draft.setQuantityText(event.target.value);
          }}
        />
        <ChipGroup
          label={PORTION_PICKER.unitLabel}
          options={UNIT_OPTIONS}
          value={unit}
          onChange={draft.setUnit}
        />
      </div>
      <TimeField value={time} isNow={isNow} onChange={onTimeChange} />
    </>
  );
}
