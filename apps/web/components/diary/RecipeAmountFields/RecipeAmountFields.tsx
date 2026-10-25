import {
  DIARY_PROBLEMS,
  FOOD_NUTRIENT_LABELS,
  PORTION_PICKER,
  RECIPE_BADGE,
  RECIPE_UNITS,
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

import type { RecipeAmountFieldsProps } from "./types";
import type { RecipeEntryUnit } from "@keylow/core/diary";

import { useSelectAmountOnChipPress } from "@/components/diary/useSelectAmountOnChipPress";
import { useSelectAmountOnFocus } from "@/components/diary/useSelectAmountOnFocus";
import { MacroHero } from "@/components/foods/FoodDetail/MacroHero";
import { Badge } from "@/components/ui/Badge";
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
 * What the add dialog's amount step and the edit dialog share for a recipe, as the web diary's recipe boards
 * draw them: the Recipe badge with what the recipe makes, what the chosen amount comes to in the hero, the
 * recipe's values per 100 g, the amount with its unit chips, and the Time field. Every figure and sentence is
 * core's, worked out from the recipe given, so the hero is what the entry stores. A recipe with no cooked
 * weight says so under the hero when grams are chosen, because those grams are of the raw ingredients.
 */
export function RecipeAmountFields({
  recipe,
  draft,
  time,
  isNow,
  onTimeChange,
  amountRef,
  notice,
  recipeNotice,
}: RecipeAmountFieldsProps) {
  const noteId = useId();
  const { amountFieldRef, onChipPress } = useSelectAmountOnChipPress(amountRef);
  const selectOnFocus = useSelectAmountOnFocus();
  const { servings, yield_grams: yieldGrams } = recipe;
  const { unit, typed } = draft;
  // Grams of a recipe with no cooked weight are of the raw ingredients, which the fields say.
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
      {notice}
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border-border">{RECIPE_BADGE}</Badge>
        <span className="text-caption tabular-nums text-text-secondary">
          {describeRecipeYield(servings, yieldGrams)}
        </span>
      </div>
      {recipeNotice}
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
          ref={amountFieldRef}
          label={PORTION_PICKER.amountLabel}
          unit={unitSuffix}
          value={draft.quantityText}
          error={typed === null ? DIARY_PROBLEMS.quantity : undefined}
          {...selectOnFocus}
          onChange={(event) => {
            draft.setQuantityText(event.target.value);
          }}
        />
        <ChipGroup
          label={PORTION_PICKER.unitLabel}
          options={UNIT_OPTIONS}
          value={unit}
          onChange={draft.setUnit}
          onChipPress={onChipPress}
        />
      </div>
      <TimeField value={time} isNow={isNow} onChange={onTimeChange} />
    </>
  );
}
