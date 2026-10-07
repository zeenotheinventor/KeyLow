import { customFoodInputSchema } from "@keylow/core/schemas";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from "react-native";

import { BasisChoice } from "./BasisChoice";
import { describeSaveError } from "./describeSaveError";
import { emptyFoodFormValues } from "./foodFormValues";
import { FormField } from "./FormField";
import { mapIssuesToErrors, portionErrorKey } from "./mapIssuesToErrors";
import { NUTRIENT_FIELDS } from "./nutrientFields";
import { PortionRow } from "./PortionRow";
import { toRawInput } from "./toRawInput";

import type { FoodFormErrors, KeyedFoodFormValues } from "./mapIssuesToErrors";
import type { TextFieldName } from "./nutrientFields";
import type { FoodFormProps } from "./types";
import type { NutrientBasis } from "@keylow/core/schemas";

const BASIS_HEADINGS: Record<NutrientBasis, string> = {
  per_100g: "Nutrition per 100 g",
  per_100ml: "Nutrition per 100 ml",
};

const BARCODE_SCAN_HINT = "Filled in from the barcode you scanned";

function withoutKeys(errors: FoodFormErrors, isRemoved: (key: string) => boolean): FoodFormErrors {
  return Object.fromEntries(Object.entries(errors).filter(([key]) => !isRemoved(key)));
}

const isPortionErrorKey = (key: string) => key === "portions" || key.includes(".");

export function FoodForm({
  submitLabel,
  initialValues = emptyFoodFormValues,
  isBarcodeLocked = false,
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
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountUnit = values.basis === "per_100g" ? "g" : "ml";

  function changeText(name: TextFieldName, text: string) {
    setValues((current) => ({ ...current, [name]: text }));
    setErrors((current) => withoutKeys(current, (key) => key === name));
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
    const result = customFoodInputSchema.safeParse(toRawInput(values));
    if (!result.success) {
      setErrors(mapIssuesToErrors(result.error.issues, values));
      setSubmitError(undefined);
      return;
    }

    setErrors({});
    setSubmitError(undefined);
    setIsSubmitting(true);
    try {
      await onSubmit(result.data);
    } catch (error) {
      setSubmitError(describeSaveError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-neutral-50"
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-6 py-6">
        <FormField
          label="Name"
          error={errors["name"]}
          value={values.name}
          onChangeText={(text) => {
            changeText("name", text);
          }}
          autoCapitalize="sentences"
        />
        <FormField
          label="Brand"
          error={errors["brand"]}
          value={values.brand}
          onChangeText={(text) => {
            changeText("brand", text);
          }}
          autoCapitalize="words"
        />
        <FormField
          label="Barcode"
          error={errors["barcode"]}
          {...(isBarcodeLocked ? { hint: BARCODE_SCAN_HINT } : {})}
          editable={!isBarcodeLocked}
          value={values.barcode}
          onChangeText={(text) => {
            changeText("barcode", text);
          }}
          keyboardType="number-pad"
        />

        <BasisChoice
          value={values.basis}
          onChange={(basis) => {
            setValues((current) => ({ ...current, basis }));
          }}
        />

        <Text accessibilityRole="header" className="text-lg font-semibold text-neutral-900">
          {BASIS_HEADINGS[values.basis]}
        </Text>
        {NUTRIENT_FIELDS.map((field) => (
          <FormField
            key={field.name}
            label={field.label}
            error={errors[field.name]}
            value={values[field.name]}
            onChangeText={(text) => {
              changeText(field.name, text);
            }}
            keyboardType="decimal-pad"
          />
        ))}

        <Text accessibilityRole="header" className="text-lg font-semibold text-neutral-900">
          Portions
        </Text>
        {values.portions.map((portion, index) => (
          <PortionRow
            key={portion.key}
            position={index + 1}
            label={portion.label}
            amount={portion.amount}
            isDefault={portion.isDefault}
            unit={amountUnit}
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
        {errors["portions"] === undefined ? null : (
          <Text accessibilityRole="alert" className="text-sm text-danger-600">
            {errors["portions"]}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={addPortion}
          className="h-12 items-center justify-center rounded-lg border border-neutral-300"
        >
          <Text className="text-base font-semibold text-neutral-900">Add portion</Text>
        </Pressable>

        {errors["form"] === undefined ? null : (
          <Text accessibilityRole="alert" className="text-sm text-danger-600">
            {errors["form"]}
          </Text>
        )}
        {submitError === undefined ? null : (
          <Text accessibilityRole="alert" className="text-sm text-danger-600">
            {submitError}
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void handleSubmit()}
          className="h-12 items-center justify-center rounded-lg bg-brand-600 disabled:opacity-50"
        >
          <Text className="text-base font-semibold text-neutral-50">{submitLabel}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
