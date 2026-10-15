import {
  DIARY_PROBLEMS,
  ENTRY_SCREEN,
  FOOD_FORM,
  FOOD_NUTRIENT_LABELS,
  MACROS_OPTIONAL,
  PORTION_PICKER,
  QUICK_ADD_FORM,
  QUICK_ADD_NOTE,
  SAVE_FAILED_BANNER,
  describeMacroTotal,
  describeQuickAddMacroField,
} from "@keylow/core/copy";
import {
  enteredNumber,
  macroKcal,
  macrosDisagreeWithCalories,
  validateQuickAdd,
} from "@keylow/core/diary";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dockBottomPadding } from "../../lib/dockBottomPadding";
import { useKeyboardLift } from "../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../lib/useScrollFocusedInputIntoView";
import { Banner, Button, Input, NumericInput, SheetHeader, Text, TimePicker, TimeRow } from "../ui";

import type { QuickAddFormProps, QuickAddFormValues } from "./types";

// The three macro fields share one row, in the order protein, carbohydrate, fat. The boards draw plain labels.
const MACRO_FIELDS = [
  { name: "protein", label: FOOD_NUTRIENT_LABELS.protein },
  { name: "carbs", label: FOOD_NUTRIENT_LABELS.carbohydrate },
  { name: "fat", label: FOOD_NUTRIENT_LABELS.fat },
] as const;

const NO_VALUES: QuickAddFormValues = { kcal: "", protein: "", carbs: "", fat: "", label: "" };

// A number that cannot be added up counts as not given, so the helper never reads "NaN kcal".
const finiteOrNull = (value: number | null): number | null =>
  value !== null && Number.isFinite(value) ? value : null;

/**
 * The quick add form, as the quick add boards draw it: calories, then protein, carbohydrate and fat in
 * grams, a label, the Time row and a note, with Add at the bottom. The helper under the calories says what
 * the macros add up to, in the review colour when they are more than a quarter off the calories; it is
 * information only. A logged quick add shows its saved values, which cannot be changed (a quick add takes a
 * new time only), with Save and a Delete under it. Add, Save and Delete wait for a connection.
 */
export function QuickAddForm(props: QuickAddFormProps) {
  const { time, isNow, isOnline, isSaving, hasSaveError, onSubmit, onLeave } = props;
  const isEditing = props.mode === "edit";
  const insets = useSafeAreaInsets();
  const frameRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard. iOS has the padding view.
  const keyboardLift = useKeyboardLift(frameRef, Platform.OS === "android");
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);
  const [values, setValues] = useState(isEditing ? props.initialValues : NO_VALUES);
  const [isKcalTouched, setIsKcalTouched] = useState(false);
  const [chosenTime, setChosenTime] = useState(time);
  const [isTimeStillNow, setIsTimeStillNow] = useState(isNow);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  const kcal = enteredNumber(values.kcal);
  const protein = enteredNumber(values.protein);
  const carbs = enteredNumber(values.carbs);
  const fat = enteredNumber(values.fat);
  const result = validateQuickAdd({
    kcal,
    protein_g: protein,
    fat_g: fat,
    carbs_g: carbs,
    label: values.label,
  });
  const kcalProblem = result.ok ? undefined : result.problems.kcal;
  // A blank field asks for calories once the person has touched it. A 0 says so at once.
  const kcalError =
    kcalProblem === "not_above_zero" || (kcalProblem === "required" && isKcalTouched)
      ? DIARY_PROBLEMS.quickAddKcal
      : undefined;
  const hasMacro = [values.protein, values.carbs, values.fat].some((text) => text.trim() !== "");
  const macroNote = hasMacro
    ? describeMacroTotal(
        Math.round(macroKcal(finiteOrNull(protein), finiteOrNull(fat), finiteOrNull(carbs))),
      )
    : MACROS_OPTIONAL;
  const disagrees = macrosDisagreeWithCalories(finiteOrNull(kcal), protein, fat, carbs);

  function change(field: keyof QuickAddFormValues, text: string) {
    setValues((current) => ({ ...current, [field]: text }));
  }

  function submit() {
    if (!result.ok) {
      return;
    }
    const { value } = result;
    onSubmit({
      kcal: value.kcal,
      protein_g: value.protein_g,
      carbs_g: value.carbs_g,
      fat_g: value.fat_g,
      label: value.label,
      time: chosenTime,
      isNow: isTimeStillNow,
    });
  }

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
            leading={
              isEditing
                ? { icon: "ChevronLeft", label: FOOD_FORM.back, onPress: onLeave }
                : { icon: "X", label: QUICK_ADD_FORM.close, onPress: onLeave }
            }
            title={isEditing ? QUICK_ADD_FORM.editTitle : QUICK_ADD_FORM.title}
          />
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerClassName="gap-4 px-4 pb-4 pt-2"
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={trackScrollOffset}
          >
            {hasSaveError ? <Banner sentence title={SAVE_FAILED_BANNER} variant="error" /> : null}
            <NumericInput
              autoFocus={!isEditing}
              error={kcalError}
              helper={disagrees ? undefined : macroNote}
              label={QUICK_ADD_FORM.caloriesLabel}
              locked={isEditing}
              missingNote={disagrees ? macroNote : undefined}
              unit="kcal"
              value={values.kcal}
              onBlur={() => {
                setIsKcalTouched(true);
              }}
              onChangeText={(text) => {
                change("kcal", text);
                setIsKcalTouched(true);
              }}
            />
            <View className="flex-row gap-2">
              {MACRO_FIELDS.map((field) => (
                <View key={field.name} className="min-w-0 flex-1">
                  <NumericInput
                    accessibilityLabel={describeQuickAddMacroField(field.label)}
                    label={field.label}
                    locked={isEditing}
                    unit="g"
                    value={values[field.name]}
                    onChangeText={(text) => {
                      change(field.name, text);
                    }}
                  />
                </View>
              ))}
            </View>
            <Input
              label={QUICK_ADD_FORM.labelLabel}
              locked={isEditing}
              placeholder={QUICK_ADD_FORM.labelPlaceholder}
              value={values.label}
              onChangeText={(text) => {
                change("label", text);
              }}
            />
            <TimeRow
              isNow={isTimeStillNow}
              open={isTimePickerOpen}
              time={chosenTime}
              onPress={() => {
                setIsTimePickerOpen(true);
              }}
            />
            <Text tone="muted" variant="caption">
              {QUICK_ADD_NOTE}
            </Text>
          </ScrollView>
          {/* The dock is the sheet's surface under a hairline, with the board's 42 below its controls. */}
          <View
            className="gap-1 border-t border-border bg-surface-sheet px-4 pb-[var(--dock-bottom)] pt-4"
            style={vars({ "--dock-bottom": dockBottomPadding(insets.bottom) })}
          >
            <Button
              disabled={!result.ok || !isOnline}
              fullWidth
              haptic="confirm"
              loading={isSaving}
              size="lg"
              onPress={submit}
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
