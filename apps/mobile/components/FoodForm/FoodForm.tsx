import { FOOD_FORM, describeNutritionHeading } from "@keylow/core/copy";
import { REQUIRED_FOOD_NUTRIENTS, customFoodInputFrom } from "@keylow/core/foods";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { vars } from "nativewind";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useKeyboardLift } from "../../lib/useKeyboardLift";
import { useScrollFocusedInputIntoView } from "../../lib/useScrollFocusedInputIntoView";
import { Banner, Button, FieldError, Input, NumericInput, SegmentedControl, Text } from "../ui";
import { describeSaveError } from "./describeSaveError";
import { emptyFoodFormValues } from "./foodFormValues";
import { mapIssuesToErrors, portionErrorKey } from "./mapIssuesToErrors";
import { PortionCard } from "./PortionCard";

import type { FoodFormErrors, KeyedFoodFormValues } from "./mapIssuesToErrors";
import type { NutrientFieldName, TextFieldName } from "./nutrientFields";
import type { FoodFormProps, SaveNotice } from "./types";
import type { NutrientBasis } from "@keylow/core/schemas";

const BASIS_OPTIONS: readonly { value: NutrientBasis; label: string }[] = [
  { value: "per_100g", label: FOOD_FORM.basisOptions.per_100g },
  { value: "per_100ml", label: FOOD_FORM.basisOptions.per_100ml },
];

// Protein, carbohydrate and fat share one row, each with its macro's colour beside the label.
const MACRO_FIELDS = [
  { name: "protein_g", macro: "protein" },
  { name: "carbs_g", macro: "carbs" },
  { name: "fat_g", macro: "fat" },
] as const;

// The footer sits on the screen's bottom inset, and never closer than the 12 points the boards give it.
const MINIMUM_FOOTER_BOTTOM_PADDING = 12;

function withoutKeys(errors: FoodFormErrors, isRemoved: (key: string) => boolean): FoodFormErrors {
  return Object.fromEntries(Object.entries(errors).filter(([key]) => !isRemoved(key)));
}

const isRequiredNutrient = (name: NutrientFieldName) =>
  REQUIRED_FOOD_NUTRIENTS.some((required) => required === name);

const isPortionErrorKey = (key: string) => key === "portions" || key.includes(".");

export function FoodForm({
  submitLabel,
  initialValues = emptyFoodFormValues,
  isBarcodeLocked = false,
  lockedBarcodeHint = FOOD_FORM.barcodeFromScan,
  nutrientNote,
  notGivenNutrients = [],
  onSubmit,
}: FoodFormProps) {
  const lastPortionNumber = useRef(initialValues.portions.length);
  const [values, setValues] = useState<KeyedFoodFormValues>(() => ({
    ...initialValues,
    portions: initialValues.portions.map((portion, index) => ({
      ...portion,
      key: `portion-${index + 1}`,
    })),
  }));
  const [errors, setErrors] = useState<FoodFormErrors>({});
  const [saveNotice, setSaveNotice] = useState<SaveNotice | undefined>(undefined);
  const insets = useSafeAreaInsets();
  const footerRef = useRef<View>(null);
  // Android 15 draws edge to edge, so the window does not resize for the keyboard and nothing moves the
  // footer. iOS has the padding view above.
  const keyboardLift = useKeyboardLift(footerRef, Platform.OS === "android");
  const scrollViewRef = useRef<ScrollView>(null);
  const trackScrollOffset = useScrollFocusedInputIntoView(scrollViewRef, keyboardLift);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function changeText(name: TextFieldName, text: string) {
    setValues((current) => ({ ...current, [name]: text }));
    setErrors((current) => withoutKeys(current, (key) => key === name));
  }

  function nutrientProps(name: NutrientFieldName) {
    return {
      error: errors[name],
      label: FOOD_FORM.nutrients[name],
      // The note above the fields says which are required, so only a screen reader is told, per field.
      required: isRequiredNutrient(name),
      missingNote:
        notGivenNutrients.includes(name) && values[name] === ""
          ? FOOD_FORM.nutrientNotGiven
          : undefined,
      value: values[name],
      onChangeText: (text: string) => {
        changeText(name, text);
      },
    };
  }

  function changePortion(key: string, patch: Partial<KeyedFoodFormValues["portions"][number]>) {
    setValues((current) => ({
      ...current,
      portions: current.portions.map((portion) =>
        portion.key === key ? { ...portion, ...patch } : portion,
      ),
    }));
  }

  function changePortionText(key: string, field: "label" | "amount", text: string) {
    changePortion(key, { [field]: text });
    setErrors((current) =>
      withoutKeys(current, (errorKey) => errorKey === portionErrorKey(key, field)),
    );
  }

  // Switching one on switches the others off, so there is never more than one default.
  function changeDefault(key: string, isDefault: boolean) {
    setValues((current) => ({
      ...current,
      portions: current.portions.map((portion) => ({
        ...portion,
        isDefault: portion.key === key ? isDefault : false,
      })),
    }));
    setErrors((current) => withoutKeys(current, (errorKey) => errorKey === "portions"));
  }

  function addPortion() {
    lastPortionNumber.current += 1;
    const key = `portion-${lastPortionNumber.current}`;
    setValues((current) => ({
      ...current,
      portions: [...current.portions, { key, label: "", amount: "", isDefault: false }],
    }));
    setErrors((current) => withoutKeys(current, isPortionErrorKey));
  }

  function removePortion(key: string) {
    setValues((current) => ({
      ...current,
      portions: current.portions.filter((portion) => portion.key !== key),
    }));
    // Messages name a portion by its position, which a removal shifts.
    setErrors((current) => withoutKeys(current, isPortionErrorKey));
  }

  async function handleSubmit() {
    const result = customFoodInputSchema.safeParse(
      customFoodInputFrom(values, values.densityGramsPerMillilitre ?? null),
    );
    if (!result.success) {
      setErrors(mapIssuesToErrors(result.error.issues, values));
      setSaveNotice(undefined);
      return;
    }

    setErrors({});
    setSaveNotice(undefined);
    setIsSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (error) {
      setSaveNotice(describeSaveError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        ref={scrollViewRef}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        contentContainerClassName="gap-4 px-4 pb-5 pt-1"
        onScroll={trackScrollOffset}
      >
        <View className="gap-3">
          <Input
            autoCapitalize="sentences"
            density="compact"
            error={errors["name"]}
            label={FOOD_FORM.name}
            labelHint={FOOD_FORM.required}
            placeholder={FOOD_FORM.namePlaceholder}
            value={values.name}
            onChangeText={(text) => {
              changeText("name", text);
            }}
          />
          <View className="flex-row gap-2">
            <View className="min-w-0 flex-1">
              <Input
                autoCapitalize="words"
                density="compact"
                error={errors["brand"]}
                label={FOOD_FORM.brand}
                placeholder={FOOD_FORM.optionalPlaceholder}
                value={values.brand}
                onChangeText={(text) => {
                  changeText("brand", text);
                }}
              />
            </View>
            <View className="min-w-0 flex-1">
              <Input
                density="compact"
                error={errors["barcode"]}
                helper={isBarcodeLocked ? lockedBarcodeHint : undefined}
                keyboardType="number-pad"
                label={FOOD_FORM.barcode}
                locked={isBarcodeLocked}
                placeholder={FOOD_FORM.optionalPlaceholder}
                value={values.barcode}
                onChangeText={(text) => {
                  changeText("barcode", text);
                }}
              />
            </View>
          </View>
        </View>

        <View className="gap-1">
          {/* The control carries the accessible name, so the visible label is not read out a second time. */}
          <Text aria-hidden tone="secondary" variant="caption">
            {FOOD_FORM.nutritionBasis}
          </Text>
          <SegmentedControl
            label={FOOD_FORM.nutritionBasis}
            options={BASIS_OPTIONS}
            value={values.basis}
            onChange={(basis) => {
              setValues((current) => ({ ...current, basis }));
            }}
          />
        </View>

        <View className="gap-3">
          <View className="gap-[2px]">
            <Text role="heading" variant="body-strong">
              {describeNutritionHeading(values.basis)}
            </Text>
            <Text tone="muted" variant="caption">
              {FOOD_FORM.nutritionNote}
            </Text>
            {nutrientNote === undefined ? null : (
              <Text className="mt-1" tone="secondary" variant="caption">
                {nutrientNote}
              </Text>
            )}
          </View>
          <NumericInput {...nutrientProps("kcal")} unit="kcal" />
          <View className="flex-row gap-2">
            {MACRO_FIELDS.map((field) => (
              <View key={field.name} className="min-w-0 flex-1">
                <NumericInput {...nutrientProps(field.name)} macro={field.macro} unit="g" />
              </View>
            ))}
          </View>
          <NumericInput {...nutrientProps("fibre_g")} unit="g" />
        </View>

        <View className="gap-3">
          <Text role="heading" variant="body-strong">
            {FOOD_FORM.portions}
          </Text>
          {values.portions.map((portion, index) => (
            <PortionCard
              key={portion.key}
              position={index + 1}
              label={portion.label}
              amount={portion.amount}
              isDefault={portion.isDefault}
              basis={values.basis}
              labelError={errors[portionErrorKey(portion.key, "label")]}
              amountError={errors[portionErrorKey(portion.key, "amount")]}
              onLabelChange={(text) => {
                changePortionText(portion.key, "label", text);
              }}
              onAmountChange={(text) => {
                changePortionText(portion.key, "amount", text);
              }}
              onDefaultChange={(isDefault) => {
                changeDefault(portion.key, isDefault);
              }}
              onRemove={() => {
                removePortion(portion.key);
              }}
            />
          ))}
          {errors["portions"] === undefined ? null : <FieldError>{errors["portions"]}</FieldError>}
          <Button className="-ml-4 self-start" icon="Plus" variant="ghost" onPress={addPortion}>
            {FOOD_FORM.addPortion}
          </Button>
        </View>
      </ScrollView>

      {/* Save stays in view while the form scrolls, and rides above the keyboard. The footer is a sibling of
          the scroll view, so its rise shortens the scroll view by as much, and Android scrolls the focused
          field into what is left. The keyboard covers the screen's bottom inset, so the footer's own padding
          is the 12 points alone while it is up. Both are runtime values no class can name, so they go
          through a variable. */}
      <View
        ref={footerRef}
        className="gap-3 border-t border-border bg-surface-sheet px-4 pt-3 pb-[var(--footer-bottom-padding)]"
        style={vars({
          "--footer-bottom-padding":
            keyboardLift > 0
              ? keyboardLift + MINIMUM_FOOTER_BOTTOM_PADDING
              : Math.max(insets.bottom, MINIMUM_FOOTER_BOTTOM_PADDING),
        })}
      >
        {saveNotice === undefined ? null : (
          <Banner
            announce
            body={saveNotice.body}
            title={saveNotice.title}
            variant={saveNotice.variant}
          />
        )}
        {errors["form"] === undefined ? null : <Banner title={errors["form"]} variant="error" />}
        <Button
          fullWidth
          haptic="confirm"
          loading={isSubmitting}
          size="lg"
          onPress={() => void handleSubmit()}
        >
          {submitLabel}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
