import { Text, TextInput, View } from "react-native";

import type { FormFieldProps } from "./types";

export function FormField({
  label,
  accessibilityLabel,
  error,
  hint,
  editable = true,
  ...inputProps
}: FormFieldProps) {
  const inputClassName = [
    "h-12 rounded-lg border px-4 text-base",
    error === undefined ? "border-neutral-300" : "border-danger-600",
    editable ? "bg-neutral-50 text-neutral-900" : "bg-neutral-100 text-neutral-500",
  ].join(" ");

  return (
    <View className="gap-1">
      {/* The input carries the accessible name, so the visible label is not read out a second time. */}
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="text-sm font-medium text-neutral-700"
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={error ?? hint}
        accessibilityState={{ disabled: !editable }}
        editable={editable}
        className={inputClassName}
        {...inputProps}
      />
      {error === undefined ? null : (
        <Text accessibilityRole="alert" className="text-sm text-danger-600">
          {error}
        </Text>
      )}
      {error === undefined && hint !== undefined ? (
        <Text className="text-sm text-neutral-500">{hint}</Text>
      ) : null}
    </View>
  );
}
