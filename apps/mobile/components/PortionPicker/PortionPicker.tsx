import {
  DIARY_PROBLEMS,
  FOOD_FORM,
  FOOD_REVIEW_BANNER,
  PORTION_PICKER,
  SAVE_FAILED_BANNER,
  describeMissingValuesBeforeLogging,
  describePortionUnit,
} from "@keylow/core/copy";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { foodNeedsReview, missingFieldsOf } from "../../lib/foodNeedsReview";
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
import { previewAmount } from "./previewAmount";
import { startingAmount, unitOptions } from "./startingAmount";
import { MacroHero } from "../FoodDetail/MacroHero";

import type { PortionPickerProps } from "./types";

// The boards leave 42 below the controls: the 34 of an iPhone's home indicator and 8. A taller navigation bar takes its own height.
const MINIMUM_BOTTOM_INSET = 34;
const BOTTOM_MARGIN = 8;

/**
 * The page for changing the serving before a food is logged, as the portion boards draw it: the food's name
 * under a Back control, what the chosen amount comes to in the hero, the food's own values per 100 g, and at
 * the bottom the amount, its unit, the Time row and Add. The amount, the unit and the time are inputs the
 * picker keeps, and Add is the only part that belongs to adding: it hands them over with `onSubmit`. A food
 * that must be reviewed first has Copy to your foods in place of Add and no Time row.
 */
export function PortionPicker({
  food,
  portions,
  initialAmount,
  time,
  isNow,
  note,
  isSaving,
  hasSaveError,
  onSubmit,
  onCopy,
  onBack,
}: PortionPickerProps) {
  const insets = useSafeAreaInsets();
  const frameRef = useRef<View>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");
  const [start] = useState(() => startingAmount(food, portions, initialAmount));
  const [quantityText, setQuantityText] = useState(start.quantity);
  const [unitValue, setUnitValue] = useState(start.unitValue);
  const [chosenTime, setChosenTime] = useState(time);
  const [isTimeStillNow, setIsTimeStillNow] = useState(isNow);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  const { amount, hero } = previewAmount(food, portions, unitValue, quantityText);
  const options = unitOptions(food, portions);
  const needsReview = foodNeedsReview(food);
  const chosenPortion = portions.find((portion) => portion.id === unitValue);
  const unitSuffix =
    chosenPortion === undefined
      ? unitValue
      : describePortionUnit(chosenPortion.label, amount?.quantity ?? 1);
  const chosenUnit = options.find((option) => option.value === unitValue);

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
            {hasSaveError ? <Banner sentence title={SAVE_FAILED_BANNER} variant="error" /> : null}
            {note === undefined ? null : (
              <View className="flex-row items-center gap-2">
                <Badge kind="source" source={food.source} />
                <Text tone="muted" variant="caption">
                  {note}
                </Text>
              </View>
            )}
            <MacroHero amount={hero} food={food} />
            <PerHundredList food={food} />
          </ScrollView>
          {/* The dock is the sheet's surface under a hairline, with the board's 42 below its controls. */}
          <View
            className="gap-3 border-t border-border bg-surface-sheet px-4 pb-[var(--dock-bottom)] pt-4"
            style={vars({
              "--dock-bottom": Math.max(insets.bottom, MINIMUM_BOTTOM_INSET) + BOTTOM_MARGIN,
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
              options={options}
              value={chosenUnit === undefined ? null : unitValue}
              onChange={setUnitValue}
            />
            {needsReview ? (
              <Button fullWidth icon="Copy" size="lg" variant="primary" onPress={onCopy}>
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
                <Button
                  fullWidth
                  disabled={amount === null}
                  haptic="confirm"
                  loading={isSaving}
                  size="lg"
                  onPress={() => {
                    if (amount !== null) {
                      onSubmit({ ...amount, time: chosenTime, isNow: isTimeStillNow });
                    }
                  }}
                >
                  {PORTION_PICKER.addAction}
                </Button>
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
