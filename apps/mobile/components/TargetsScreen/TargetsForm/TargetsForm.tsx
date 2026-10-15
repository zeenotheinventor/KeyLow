import { useUpdateTargets } from "@keylow/api-client";
import {
  DIARY_PROBLEMS,
  MACROS_OPTIONAL,
  OFFLINE_BANNER,
  SAVE_FAILED_BANNER,
  TARGETS_NOTE,
  TARGETS_SAVED_TOAST,
  TARGETS_SCREEN,
  TARGET_KCAL_HELPER,
  describeMacroTargetField,
  describeMacroTotal,
} from "@keylow/core/copy";
import { macroKcal, validateTargets } from "@keylow/core/diary";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { enteredNumber, fieldText } from "./enteredNumber";
import { useIsOnline } from "../../../lib/connectivity";
import { useKeyboardLift } from "../../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../../lib/useScrollFocusedInputIntoView";
import { Banner, Button, NumericInput, Text, useToast } from "../../ui";

import type { TargetsFormProps } from "./types";

// The three macro fields share one row. They are not marked with the macro colours: the board draws plain labels.
const MACRO_FIELDS = [
  { name: "protein", label: TARGETS_SCREEN.protein },
  { name: "carbs", label: TARGETS_SCREEN.carbs },
  { name: "fat", label: TARGETS_SCREEN.fat },
] as const;

// The footer sits on the screen's bottom inset with the 8 points the board adds, and never closer than 12.
const FOOTER_EXTRA_PADDING = 8;
const MINIMUM_FOOTER_BOTTOM_PADDING = 12;

/**
 * The Targets form: calories (whole numbers from 800 to 6,000, required) and protein, carbohydrate and fat in grams, with a
 * live note of what the macros add up to. Save is dimmed until the targets pass core's `validateTargets`.
 * A save goes back to where the user came from with the Toast "Targets saved".
 */
export function TargetsForm({ initial }: TargetsFormProps) {
  const router = useRouter();
  const toast = useToast();
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();
  const updateTargets = useUpdateTargets();
  const [kcal, setKcal] = useState(fieldText(initial.kcal));
  const [protein, setProtein] = useState(fieldText(initial.protein_g));
  const [carbs, setCarbs] = useState(fieldText(initial.carbs_g));
  const [fat, setFat] = useState(fieldText(initial.fat_g));
  const [isKcalTouched, setIsKcalTouched] = useState(false);
  const [hasSaveFailed, setHasSaveFailed] = useState(false);
  const footerRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const keyboardLift = useKeyboardLift(footerRef, Platform.OS === "android");
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);

  const input = {
    kcal: enteredNumber(kcal),
    protein_g: enteredNumber(protein),
    carbs_g: enteredNumber(carbs),
    fat_g: enteredNumber(fat),
  };
  const result = validateTargets(input);
  const kcalProblem = result.ok ? undefined : result.problems.kcal;
  // A blank field asks for a number once the person has touched it. A number out of range says so at once.
  const kcalError =
    kcalProblem === "out_of_range"
      ? DIARY_PROBLEMS.targetKcal
      : kcalProblem === "not_whole"
        ? DIARY_PROBLEMS.targetKcalWhole
        : kcalProblem === "required" && isKcalTouched
          ? DIARY_PROBLEMS.targetKcalRequired
          : undefined;
  const hasMacro = protein.trim() !== "" || carbs.trim() !== "" || fat.trim() !== "";
  const macroNote = hasMacro
    ? describeMacroTotal(Math.round(macroKcal(input.protein_g, input.fat_g, input.carbs_g)))
    : MACROS_OPTIONAL;

  async function save() {
    if (!result.ok) {
      return;
    }
    setHasSaveFailed(false);
    try {
      await updateTargets.mutateAsync(input);
    } catch {
      setHasSaveFailed(true);
      return;
    }
    toast.show({ message: TARGETS_SAVED_TOAST, tone: "success", icon: "Check" });
    // A cold link to this screen has nothing before it, so Save goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1"
    >
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        contentContainerClassName="gap-4 px-4 pb-4 pt-2"
        onScroll={trackScrollOffset}
      >
        <NumericInput
          error={kcalError}
          helper={TARGET_KCAL_HELPER}
          label={TARGETS_SCREEN.calories}
          unit="kcal"
          value={kcal}
          onBlur={() => {
            setIsKcalTouched(true);
          }}
          onChangeText={(text) => {
            setKcal(text);
            setIsKcalTouched(true);
          }}
        />
        <View className="gap-[6px]">
          <View className="flex-row gap-2">
            {MACRO_FIELDS.map((field) => (
              <View key={field.name} className="min-w-0 flex-1">
                <NumericInput
                  accessibilityLabel={describeMacroTargetField(field.label)}
                  label={field.label}
                  unit="g"
                  value={{ protein, carbs, fat }[field.name]}
                  onChangeText={{ protein: setProtein, carbs: setCarbs, fat: setFat }[field.name]}
                />
              </View>
            ))}
          </View>
          <Text tone="muted" variant="caption">
            {macroNote}
          </Text>
        </View>
        <Text tone="muted" variant="caption">
          {TARGETS_NOTE}
        </Text>
      </ScrollView>
      {/* Save stays in view and rides above the keyboard, as the food form's does. Its padding is a runtime
          value no class can name, so it goes through a variable. */}
      <View
        ref={footerRef}
        className="gap-3 border-t border-border bg-surface-sheet px-4 pt-4 pb-[var(--footer-bottom-padding)]"
        style={vars({
          "--footer-bottom-padding":
            keyboardLift > 0
              ? keyboardLift + MINIMUM_FOOTER_BOTTOM_PADDING
              : Math.max(insets.bottom + FOOTER_EXTRA_PADDING, MINIMUM_FOOTER_BOTTOM_PADDING),
        })}
      >
        {isOnline ? null : (
          <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
        )}
        {hasSaveFailed ? <Banner sentence title={SAVE_FAILED_BANNER} variant="error" /> : null}
        <Button
          disabled={!result.ok || !isOnline}
          fullWidth
          haptic="confirm"
          loading={updateTargets.isPending}
          size="lg"
          onPress={() => void save()}
        >
          {TARGETS_SCREEN.save}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
