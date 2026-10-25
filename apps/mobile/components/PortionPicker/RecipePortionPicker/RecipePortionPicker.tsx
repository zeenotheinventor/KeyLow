import {
  DIARY_PROBLEMS,
  ENTRY_SCREEN,
  PORTION_PICKER,
  RECIPE_BADGE,
  RECIPE_UNITS,
  SAVE_FAILED_BANNER,
  describeRawGramsNote,
  describeRecipeAmountBasis,
  describeRecipePer100Heading,
  describeRecipeYield,
  describeServingSuffix,
} from "@keylow/core/copy";
import {
  amountOnUnitChange,
  previewTypedRecipeAmount,
  recipeAmountStart,
} from "@keylow/core/diary";
import { useState } from "react";
import { View } from "react-native";

import { MacroHero } from "../../FoodDetail/MacroHero";
import { Badge, Banner, Button, ChipGroup, Icon, NumericInput, Text } from "../../ui";
import { PerHundredList } from "../PerHundredList";
import { PortionPickerShell } from "../PortionPickerShell";
import { useSelectAmountOnChipPress } from "../useSelectAmountOnChipPress";

import type { RecipeEntryPickerProps, RecipePortionPickerProps } from "../types";
import type { RecipeEntryUnit } from "@keylow/core/diary";

// The two chips of a recipe, a number of servings first because it is the recipe's own unit.
const UNIT_OPTIONS: readonly { value: RecipeEntryUnit; label: string }[] = [
  { value: "serving", label: RECIPE_UNITS.serving },
  { value: "g", label: RECIPE_UNITS.grams },
];

/**
 * The amount step of a recipe, as portion · recipe-serving, recipe-grams and recipe-grams-no-cooked-weight
 * draw it, and, for a logged entry, as entry · recipe, recipe-grams and recipe-archived draw it: the recipe's name under Back, a Recipe badge and what it makes, what the chosen amount comes to
 * in the hero, the recipe's values per 100 g, and at the bottom the amount, its unit, the Time row and Add.
 * Every figure and sentence is core's, worked out from the recipe's `computed` cache, so the hero is what
 * the entry stores. A recipe with no cooked weight says so under the hero when grams are chosen, because
 * those grams are of the raw ingredients. Add hands the amount and the time over with `onSubmit`.
 *
 * A logged entry's page (the edit-recipe mode) is the same page from the entry's own snapshot: it starts on
 * the amount the entry was logged with, the Time row shows the entry's time and never "Now", Save takes the
 * place of Add, and a ghost Delete sits under it. Save and Delete are dimmed and do nothing while offline.
 */
export function RecipePortionPicker(props: RecipePortionPickerProps | RecipeEntryPickerProps) {
  const { recipe, time, isSaving, hasSaveError, isOnline = true, onBack, onSubmit } = props;
  const entry = props.mode === "edit-recipe" ? props : undefined;
  const [start] = useState(() => entry?.amount ?? recipeAmountStart());
  const [quantityText, setQuantityText] = useState(() => String(start.quantity));
  const [unit, setUnit] = useState<RecipeEntryUnit>(() => start.unit);

  // A different chip starts at its own amount, so a typed 300 never reads as 300 servings or 1 as 1 g.
  const chooseUnit = (next: RecipeEntryUnit) => {
    setQuantityText(amountOnUnitChange(unit, next, quantityText));
    setUnit(next);
  };

  const { amountRef, onChipPress } = useSelectAmountOnChipPress(quantityText);

  const typed = previewTypedRecipeAmount(recipe, unit, quantityText);
  const { servings, yield_grams: yieldGrams } = recipe;
  // Grams of a recipe with no cooked weight are of the raw ingredients, which the screen says.
  const isRawGrams = yieldGrams === null && unit === "g";
  const hero =
    typed === null
      ? { caption: PORTION_PICKER.noAmountBasis, values: null }
      : {
          caption: describeRecipeAmountBasis({
            unit,
            quantity: typed.amount.quantity,
            resolvedGrams: typed.resolvedGrams,
          }),
          values: typed.values,
        };
  const unitSuffix =
    unit === "g" ? RECIPE_UNITS.grams : describeServingSuffix(typed?.amount.quantity ?? 1);

  return (
    <PortionPickerShell
      controls={
        <>
          <NumericInput
            error={typed === null ? DIARY_PROBLEMS.quantity : undefined}
            inputRef={amountRef}
            label={PORTION_PICKER.amountLabel}
            unit={unitSuffix}
            value={quantityText}
            onChangeText={setQuantityText}
          />
          {/* The row runs on past the dock's padding to the screen edge, as the food picker's does. */}
          <ChipGroup
            className="-mr-4"
            label={PORTION_PICKER.unitLabel}
            options={UNIT_OPTIONS}
            value={unit}
            onChange={chooseUnit}
            onChipPress={onChipPress}
          />
        </>
      }
      isNow={props.mode === "recipe" && props.isNow}
      renderActions={({ time: chosenTime, isNow: isTimeStillNow }) => (
        <View className="gap-1">
          <Button
            fullWidth
            disabled={typed === null || !isOnline}
            haptic="confirm"
            loading={isSaving}
            size="lg"
            onPress={() => {
              if (typed === null) {
                return;
              }
              onSubmit({ ...typed.amount, time: chosenTime, isNow: isTimeStillNow });
            }}
          >
            {entry === undefined ? PORTION_PICKER.addAction : ENTRY_SCREEN.saveAction}
          </Button>
          {entry === undefined ? null : (
            <Button
              disabled={!isOnline}
              fullWidth
              icon="Trash2"
              tone="danger"
              variant="ghost"
              onPress={entry.onDelete}
            >
              {ENTRY_SCREEN.deleteAction}
            </Button>
          )}
        </View>
      )}
      showsTime
      time={time}
      title={recipe.name}
      onBack={onBack}
    >
      {hasSaveError ? <Banner sentence title={SAVE_FAILED_BANNER} variant="error" /> : null}
      <View className="flex-row items-center gap-2">
        <Badge outlined>{RECIPE_BADGE}</Badge>
        <Text tone="muted" variant="caption">
          {describeRecipeYield(servings, yieldGrams)}
        </Text>
      </View>
      {entry?.caption === undefined ? null : (
        <Text tone="secondary" variant="caption">
          {entry.caption}
        </Text>
      )}
      <MacroHero amount={hero} />
      {isRawGrams ? (
        // A line of text a screen reader reads once, in its place under the hero.
        <View className="flex-row items-start gap-2">
          <Icon name="Info" size="sm" tone="secondary" />
          <Text className="flex-1" tone="secondary" variant="caption">
            {describeRawGramsNote(recipe.computed.effectiveGrams)}
          </Text>
        </View>
      ) : null}
      <PerHundredList
        heading={describeRecipePer100Heading(yieldGrams)}
        values={recipe.computed.per100g}
      />
    </PortionPickerShell>
  );
}
