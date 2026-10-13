import { legacyColors } from "@keylow/tokens";
import { Pressable, Switch, Text, View } from "react-native";

import { FormField } from "../FormField";

import type { PortionRowProps } from "./types";

export function PortionRow({
  position,
  label,
  amount,
  isDefault,
  unit,
  labelError,
  amountError,
  onLabelChange,
  onAmountChange,
  onDefaultChange,
  onRemove,
}: PortionRowProps) {
  const portionName = label.trim() === "" ? String(position) : label.trim();

  return (
    <View className="gap-3 rounded-lg border border-legacy-neutral-300 p-4">
      <FormField
        label="Portion label"
        accessibilityLabel={`Portion ${position} label`}
        error={labelError}
        value={label}
        onChangeText={onLabelChange}
        autoCapitalize="sentences"
      />
      <FormField
        label={`Amount (${unit})`}
        accessibilityLabel={`Portion ${position} amount (${unit})`}
        error={amountError}
        value={amount}
        onChangeText={onAmountChange}
        keyboardType="decimal-pad"
      />
      <View className="min-h-11 flex-row items-center justify-between">
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="text-base text-legacy-neutral-900"
        >
          Default portion
        </Text>
        <Switch
          accessibilityLabel={`Portion ${position} default`}
          value={isDefault}
          onValueChange={onDefaultChange}
          trackColor={{
            false: legacyColors["legacy-neutral"]["300"],
            true: legacyColors["legacy-brand"]["600"],
          }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove portion ${portionName}`}
        onPress={onRemove}
        className="h-12 items-center justify-center rounded-lg border border-legacy-danger-600"
      >
        <Text className="text-base font-semibold text-legacy-danger-600">Remove</Text>
      </Pressable>
    </View>
  );
}
