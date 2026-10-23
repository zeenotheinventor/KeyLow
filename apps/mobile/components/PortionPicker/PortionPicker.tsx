import {
  DIARY_PROBLEMS,
  ENTRY_SCREEN,
  FOOD_REVIEW_BANNER,
  PORTION_PICKER,
  RECIPE_EDITOR,
  SAVE_FAILED_BANNER,
  describeMissingValuesBeforeLogging,
  describePer100Heading,
  describePortionUnit,
} from "@keylow/core/copy";
import {
  amountOnUnitChange,
  entryPickerChoices,
  foodNeedsReview,
  missingFieldsOf,
  pickerChoices,
  previewAmount,
  reselectUnit,
  snapshotAmountStart,
  snapshotAsFood,
  startingAmount,
} from "@keylow/core/diary";
import { useState } from "react";
import { View } from "react-native";

import { PerHundredList } from "./PerHundredList";
import { PortionPickerShell } from "./PortionPickerShell";
import { RecipePortionPicker } from "./RecipePortionPicker";
import { MacroHero } from "../FoodDetail/MacroHero";
import { Badge, Banner, Button, ChipGroup, NumericInput, Text } from "../ui";

import type { FoodPortionPickerProps, PortionPickerProps } from "./types";
import type { PickerChoices } from "@keylow/core/diary";

/**
 * The page for choosing an amount before something is logged or saved: a food's (add, edit, and the two
 * ingredient modes) or a recipe's (add, and edit for a logged entry).
 */
export function PortionPicker(props: PortionPickerProps) {
  return props.mode === "recipe" || props.mode === "edit-recipe" ? (
    <RecipePortionPicker {...props} />
  ) : (
    <FoodPortionPicker {...props} />
  );
}

/**
 * The page for changing the serving before a food is logged, as the portion boards draw it: the food's name
 * under a Back control, what the chosen amount comes to in the hero, the food's own values per 100 g, and at
 * the bottom the amount, its unit, the Time row and Add. The amount, the unit and the time are inputs the
 * picker keeps, and Add is the only part that belongs to adding: it hands them over with `onSubmit`. A food
 * that must be reviewed first has Copy to your foods in place of Add and no Time row. An ingredient already in
 * a recipe has the logged entry's page without the Time row, with Save and Remove from recipe: nothing is
 * logged or saved, so it works offline. A food about to join a recipe has the add page without the Time row,
 * with the food's source under the title and Add to recipe; a food that must be reviewed first cannot be added.
 */
function FoodPortionPicker(props: FoodPortionPickerProps) {
  const { food, onBack } = props;
  // The pages that log a food at a time. An ingredient's amount step is not one.
  const logging = props.mode === "add" || props.mode === "edit" ? props : undefined;
  const isOnline = logging?.isOnline ?? true;
  // A logged entry and an ingredient are worked from the snapshot they were saved with.
  const isFromSnapshot = props.mode === "edit" || props.mode === "edit-ingredient";
  // An added food's chips come from the food and its portions; a logged entry's, from its own snapshot and the
  // food's portions, while its hero is worked out from the snapshot alone. The hero gets the portions the chips
  // came from.
  const choices: PickerChoices =
    props.mode === "add" || props.mode === "add-ingredient"
      ? pickerChoices(food, props.portions)
      : entryPickerChoices(props.snapshot, props.livePortions);
  const amountFood =
    props.mode === "add" || props.mode === "add-ingredient" ? food : snapshotAsFood(props.snapshot);
  const [start] = useState(() =>
    props.mode === "add" || props.mode === "add-ingredient"
      ? startingAmount(food, choices.portions, props.initialAmount)
      : snapshotAmountStart(props.snapshot),
  );
  const [quantityText, setQuantityText] = useState(start.quantity);
  const [unitValue, setUnitValue] = useState(start.unitValue);
  // The words on the chosen chip, because a refresh of the food replaces its portions with new ids and the
  // label is what is left to find the chip by.
  const [unitLabel, setUnitLabel] = useState(
    () => choices.options.find((option) => option.value === start.unitValue)?.label ?? "",
  );
  // A different chip starts at its own amount, so a typed 100 never reads as 100 tbsp or 1 as 1 g.
  const chooseUnit = (next: string) => {
    setQuantityText(amountOnUnitChange(unitValue, next, quantityText));
    setUnitValue(next);
    setUnitLabel(choices.options.find((option) => option.value === next)?.label ?? "");
  };
  // The portions of a food being added can be replaced while the picker is open. When the chosen chip's id is
  // gone, the chip with the same label takes over and the typed amount stays; with no such chip the picker
  // moves to the food's default and starts the amount again. A logged entry works from its snapshot instead.
  const isAdding = props.mode === "add" || props.mode === "add-ingredient";
  if (isAdding && !choices.options.some((option) => option.value === unitValue)) {
    const reselected = reselectUnit(
      { unitValue, label: unitLabel, quantityText },
      choices.options,
      startingAmount(food, choices.portions).unitValue,
    );
    setUnitValue(reselected.unitValue);
    setUnitLabel(
      choices.options.find((option) => option.value === reselected.unitValue)?.label ?? "",
    );
    setQuantityText(reselected.quantity);
  }

  const { amount, hero } = previewAmount(amountFood, choices.portions, unitValue, quantityText);
  // A logged entry keeps the values it was saved with, so the food's own review does not apply to it.
  const needsReview = !isFromSnapshot && foodNeedsReview(food);
  const chosenPortion = choices.portions.find((portion) => portion.id === unitValue);
  const unitSuffix =
    chosenPortion === undefined
      ? unitValue
      : describePortionUnit(chosenPortion.label, amount?.quantity ?? 1);
  const chosenUnit = choices.options.find((option) => option.value === unitValue);

  return (
    <PortionPickerShell
      controls={
        <>
          <NumericInput
            error={amount === null ? DIARY_PROBLEMS.quantity : undefined}
            label={PORTION_PICKER.amountLabel}
            unit={unitSuffix}
            value={quantityText}
            onChangeText={setQuantityText}
          />
          {/* The row runs on past the dock's padding to the screen edge, so a chip cut off there says it scrolls. */}
          <ChipGroup
            className="-mr-4"
            label={PORTION_PICKER.unitLabel}
            options={choices.options}
            value={chosenUnit === undefined ? null : unitValue}
            onChange={chooseUnit}
          />
        </>
      }
      isNow={logging?.isNow ?? false}
      renderActions={({ time, isNow }) =>
        props.mode === "add" && needsReview ? (
          <Button fullWidth icon="Copy" size="lg" variant="primary" onPress={props.onCopy}>
            {FOOD_REVIEW_BANNER.action}
          </Button>
        ) : (
          <View className="gap-1">
            <Button
              fullWidth
              disabled={
                amount === null || !isOnline || (props.mode === "add-ingredient" && needsReview)
              }
              haptic="confirm"
              loading={logging?.isSaving ?? false}
              size="lg"
              onPress={() => {
                if (amount === null) {
                  return;
                }
                if (props.mode === "edit-ingredient" || props.mode === "add-ingredient") {
                  props.onSubmit(amount);
                } else {
                  props.onSubmit({ ...amount, time, isNow });
                }
              }}
            >
              {isFromSnapshot
                ? ENTRY_SCREEN.saveAction
                : props.mode === "add-ingredient"
                  ? RECIPE_EDITOR.addToRecipe
                  : PORTION_PICKER.addAction}
            </Button>
            {props.mode === "edit" ? (
              <Button
                disabled={!isOnline}
                fullWidth
                icon="Trash2"
                tone="danger"
                variant="ghost"
                onPress={props.onDelete}
              >
                {ENTRY_SCREEN.deleteAction}
              </Button>
            ) : null}
            {props.mode === "edit-ingredient" ? (
              <Button
                fullWidth
                icon="Trash2"
                tone="danger"
                variant="ghost"
                onPress={props.onRemove}
              >
                {RECIPE_EDITOR.removeFromRecipe}
              </Button>
            ) : null}
          </View>
        )
      }
      showsTime={logging !== undefined && !(props.mode === "add" && needsReview)}
      time={logging?.time ?? ""}
      title={food.name}
      onBack={onBack}
    >
      {needsReview ? (
        <Banner
          body={describeMissingValuesBeforeLogging(
            missingFieldsOf(food),
            food.quality.carbs_convention,
          )}
          title={FOOD_REVIEW_BANNER.title}
          variant="review"
        />
      ) : null}
      {props.mode === "edit" ? props.banner : null}
      {logging?.hasSaveError === true ? (
        <Banner sentence title={SAVE_FAILED_BANNER} variant="error" />
      ) : null}
      {logging?.note === undefined ? null : (
        <View className="flex-row items-center gap-2">
          <Badge kind="source" source={food.source} />
          <Text tone="muted" variant="caption">
            {logging.note}
          </Text>
        </View>
      )}
      {props.mode === "add-ingredient" ? (
        <View className="flex-row">
          <Badge kind="source" source={food.source} />
        </View>
      ) : null}
      {props.mode === "edit" && props.caption !== undefined ? (
        <Text tone="secondary" variant="caption">
          {props.caption}
        </Text>
      ) : null}
      <MacroHero amount={hero} food={food} />
      <PerHundredList heading={describePer100Heading(food.basis)} values={food} />
    </PortionPickerShell>
  );
}
