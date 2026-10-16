import {
  DIARY_PROBLEMS,
  ENTRY_SCREEN,
  FOOD_FORM,
  FOOD_REVIEW_BANNER,
  PORTION_PICKER,
  SAVE_FAILED_BANNER,
  describeMissingValuesBeforeLogging,
  describePortionUnit,
} from "@keylow/core/copy";
import {
  amountOnUnitChange,
  entryPickerChoices,
  foodNeedsReview,
  missingFieldsOf,
  pickerChoices,
  previewAmount,
  snapshotAmountStart,
  snapshotAsFood,
  startingAmount,
} from "@keylow/core/diary";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dockBottomPadding } from "../../lib/dockBottomPadding";
import { useKeyboardLift } from "../../lib/useKeyboardLift";
import {
  Badge,
  Banner,
  Button,
  ChipGroup,
  NumericInput,
  SheetHeader,
  Text,
  TimePicker,
  TimeRow,
} from "../ui";
import { PerHundredList } from "./PerHundredList";
import { MacroHero } from "../FoodDetail/MacroHero";

import type { PortionPickerProps } from "./types";
import type { PickerChoices } from "@keylow/core/diary";

/**
 * The page for changing the serving before a food is logged, as the portion boards draw it: the food's name
 * under a Back control, what the chosen amount comes to in the hero, the food's own values per 100 g, and at
 * the bottom the amount, its unit, the Time row and Add. The amount, the unit and the time are inputs the
 * picker keeps, and Add is the only part that belongs to adding: it hands them over with `onSubmit`. A food
 * that must be reviewed first has Copy to your foods in place of Add and no Time row.
 */
export function PortionPicker(props: PortionPickerProps) {
  const {
    food,
    time,
    isNow,
    note,
    isSaving,
    hasSaveError,
    isOnline = true,
    onSubmit,
    onBack,
  } = props;
  const isEditing = props.mode === "edit";
  const insets = useSafeAreaInsets();
  const frameRef = useRef<View>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");
  // An added food's chips come from the food and its portions; a logged entry's, from its own snapshot, which
  // is also what its hero is worked out from. The hero gets the portions the chips came from.
  const choices: PickerChoices =
    props.mode === "edit"
      ? entryPickerChoices(props.snapshot)
      : pickerChoices(food, props.portions);
  const amountFood = props.mode === "edit" ? snapshotAsFood(props.snapshot) : food;
  const [start] = useState(() =>
    props.mode === "edit"
      ? snapshotAmountStart(props.snapshot)
      : startingAmount(food, choices.portions, props.initialAmount),
  );
  const [quantityText, setQuantityText] = useState(start.quantity);
  const [unitValue, setUnitValue] = useState(start.unitValue);
  // A different chip starts at its own amount, so a typed 100 never reads as 100 tbsp or 1 as 1 g.
  const chooseUnit = (next: string) => {
    setQuantityText(amountOnUnitChange(unitValue, next, quantityText));
    setUnitValue(next);
  };
  const [chosenTime, setChosenTime] = useState(time);
  const [isTimeStillNow, setIsTimeStillNow] = useState(isNow);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  const { amount, hero } = previewAmount(amountFood, choices.portions, unitValue, quantityText);
  // A logged entry keeps the values it was saved with, so the food's own review does not apply to it.
  const needsReview = !isEditing && foodNeedsReview(food);
  const chosenPortion = choices.portions.find((portion) => portion.id === unitValue);
  const unitSuffix =
    chosenPortion === undefined
      ? unitValue
      : describePortionUnit(chosenPortion.label, amount?.quantity ?? 1);
  const chosenUnit = choices.options.find((option) => option.value === unitValue);

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {/* The insets and the keyboard's cover are runtime values no class can name, so they go through variables. */}
        <View
          ref={frameRef}
          className="flex-1 pb-[var(--keyboard-lift)] pt-[var(--inset-top)]"
          style={vars({ "--inset-top": insets.top, "--keyboard-lift": keyboardLift })}
        >
          <SheetHeader
            leading={{ icon: "ChevronLeft", label: FOOD_FORM.back, onPress: onBack }}
            title={food.name}
          />
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-3 px-4 pb-4"
            keyboardShouldPersistTaps="handled"
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
            {hasSaveError ? <Banner sentence title={SAVE_FAILED_BANNER} variant="error" /> : null}
            {note === undefined ? null : (
              <View className="flex-row items-center gap-2">
                <Badge kind="source" source={food.source} />
                <Text tone="muted" variant="caption">
                  {note}
                </Text>
              </View>
            )}
            {props.mode === "edit" && props.caption !== undefined ? (
              <Text tone="secondary" variant="caption">
                {props.caption}
              </Text>
            ) : null}
            <MacroHero amount={hero} food={food} />
            <PerHundredList food={food} />
          </ScrollView>
          {/* The dock is the sheet's surface under a hairline, with the board's 42 below its controls. */}
          <View
            className="gap-3 border-t border-border bg-surface-sheet px-4 pb-[var(--dock-bottom)] pt-4"
            style={vars({
              "--dock-bottom": dockBottomPadding(insets.bottom),
            })}
          >
            <NumericInput
              error={amount === null ? DIARY_PROBLEMS.quantity : undefined}
              label={PORTION_PICKER.amountLabel}
              unit={unitSuffix}
              value={quantityText}
              onChangeText={setQuantityText}
            />
            <ChipGroup
              label={PORTION_PICKER.unitLabel}
              options={choices.options}
              value={chosenUnit === undefined ? null : unitValue}
              onChange={chooseUnit}
            />
            {props.mode === "add" && needsReview ? (
              <Button fullWidth icon="Copy" size="lg" variant="primary" onPress={props.onCopy}>
                {FOOD_REVIEW_BANNER.action}
              </Button>
            ) : (
              <>
                <TimeRow
                  isNow={isTimeStillNow}
                  open={isTimePickerOpen}
                  time={chosenTime}
                  onPress={() => {
                    setIsTimePickerOpen(true);
                  }}
                />
                <View className="gap-1">
                  <Button
                    fullWidth
                    disabled={amount === null || !isOnline}
                    haptic="confirm"
                    loading={isSaving}
                    size="lg"
                    onPress={() => {
                      if (amount !== null) {
                        onSubmit({ ...amount, time: chosenTime, isNow: isTimeStillNow });
                      }
                    }}
                  >
                    {isEditing ? ENTRY_SCREEN.saveAction : PORTION_PICKER.addAction}
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
                </View>
              </>
            )}
          </View>
        </View>
        <TimePicker
          open={isTimePickerOpen}
          value={chosenTime}
          onChange={(next) => {
            setChosenTime(next);
            setIsTimeStillNow(false);
          }}
          onClose={() => {
            setIsTimePickerOpen(false);
          }}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
