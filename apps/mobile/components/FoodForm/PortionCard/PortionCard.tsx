import {
  FOOD_FORM,
  describePortionAmountField,
  describePortionField,
  describePortionGroup,
  describePortionLabelField,
  describeRemovePortion,
} from "@keylow/core/copy";
import { amountUnit } from "@keylow/core/foods";
import { View } from "react-native";

import { Button, Card, FieldError, Input, NumericInput, Switch, Text } from "../../ui";

import type { PortionCardProps } from "./types";

/**
 * One portion on the food form: a label, an amount in the basis's unit, the default switch and a remove
 * button, in a card, as the food form boards draw it. The card is a group named by the portion's
 * position, because every portion has the same two field labels.
 */
export function PortionCard({
  position,
  label,
  amount,
  isDefault,
  basis,
  labelError,
  amountError,
  onLabelChange,
  onAmountChange,
  onDefaultChange,
  onRemove,
}: PortionCardProps) {
  const unit = amountUnit(basis);

  return (
    <Card aria-label={describePortionGroup(position)} padding={3} role="group">
      <View className="gap-3">
        <Input
          accessibilityLabel={describePortionLabelField(position)}
          autoCapitalize="sentences"
          density="compact"
          error={labelError}
          label={FOOD_FORM.portionLabel}
          placeholder={FOOD_FORM.portionLabelPlaceholder}
          value={label}
          onChangeText={onLabelChange}
        />
        <View className="flex-row items-end gap-3">
          <View className="min-w-0 flex-1">
            <NumericInput
              accessibilityLabel={describePortionAmountField(position, basis)}
              error={amountError}
              errorShownElsewhere
              label={FOOD_FORM.amount}
              unit={unit}
              value={amount}
              onChangeText={onAmountChange}
            />
          </View>
          <View className="h-control-md min-w-0 flex-1 flex-row items-center justify-between gap-2">
            <Text variant="label-small">{FOOD_FORM.makeDefault}</Text>
            <Switch
              isOn={isDefault}
              label={describePortionField("default", position)}
              onValueChange={onDefaultChange}
            />
          </View>
        </View>
        {/* The board draws the amount's message across the whole row, not in the half the field takes. */}
        {amountError === undefined ? null : (
          <FieldError className="-mt-2">{amountError}</FieldError>
        )}
        {/* The board draws Remove with 8 of padding and a margin of -4, so its content starts 4 in. The kit's small button has the same 8 and a 1 point border, so the margin is -5. */}
        <Button
          accessibilityLabel={describeRemovePortion(label, position)}
          className="-ml-[5px] -mt-1 self-start"
          icon="Trash2"
          quiet
          size="sm"
          variant="ghost"
          onPress={onRemove}
        >
          {FOOD_FORM.remove}
        </Button>
      </View>
    </Card>
  );
}
