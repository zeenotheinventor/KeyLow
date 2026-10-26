import {
  PLATE,
  describePlateAmountField,
  describePlateRowOpenName,
  describeRemoveFromPlate,
} from "@keylow/core/copy";
import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { Macros } from "../FoodRow";
import { useGroupedRowPosition } from "../GroupedList";
import { IconButton } from "../IconButton";
import { FieldError } from "../Input";
import { NumericInput } from "../NumericInput";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";

import type { PlateRowProps } from "./types";

/**
 * A row of "Your plate": the name with its stats line, the amount to change in place, and the X that takes
 * the food off. It is a list item for `GroupedList`, which draws the card and puts the divider above it.
 */
export function PlateRow({
  name,
  isRecipe = false,
  energy,
  macros,
  amountText,
  unitWord,
  unitsWord,
  onAmountChange,
  onOpen,
  onRemove,
  isOpenDisabled = false,
  disabled = false,
  autoFocus = false,
  error,
}: PlateRowProps) {
  const { isFirst } = useGroupedRowPosition();
  const hasError = error !== undefined && error.trim() !== "";
  // While the whole row is dimmed, the name is already dimmed with it. A name that is not a button is never dimmed.
  const dimsName = onOpen !== undefined && isOpenDisabled && !disabled;
  const nameBlock = (
    <>
      <Text numberOfLines={2} variant="body-strong">
        {name}
      </Text>
      {isRecipe ? (
        <Text tone="muted" variant="caption">
          {PLATE.recipe}
        </Text>
      ) : null}
      <Macros energy={energy} macros={macros} />
    </>
  );

  return (
    <View className={`${isFirst ? "" : "border-t border-border"} ${disabled ? "opacity-40" : ""}`}>
      <View className="flex-row items-center gap-2 py-2 pl-3 pr-1">
        <View className={`min-w-0 flex-1 ${dimsName ? "opacity-40" : ""}`}>
          {onOpen === undefined ? (
            <View className="min-h-[48px] justify-center gap-1">{nameBlock}</View>
          ) : (
            <PressableSurface
              className="min-h-[48px] justify-center gap-1"
              disabled={disabled || isOpenDisabled}
              label={describePlateRowOpenName(name, amountText, unitWord, energy)}
              pressScale={rowPressScale}
              onPress={onOpen}
            >
              {nameBlock}
            </PressableSurface>
          )}
        </View>
        <View className="w-[112px] shrink-0">
          <NumericInput
            accessibilityLabel={describePlateAmountField(name, unitsWord)}
            autoFocus={autoFocus}
            dimsWhenDisabled={false}
            disabled={disabled}
            error={hasError ? error : undefined}
            errorShownElsewhere
            label={describePlateAmountField(name, unitsWord)}
            labelHidden
            selectTextOnFocus
            size="sm"
            unit={unitWord}
            value={amountText}
            onChangeText={onAmountChange}
          />
        </View>
        <IconButton
          dimsWhenDisabled={false}
          disabled={disabled}
          icon="X"
          label={describeRemoveFromPlate(name)}
          tone="secondary"
          variant="ghost"
          onPress={onRemove}
        />
      </View>
      {hasError ? (
        <View className="px-3 pb-2">
          <FieldError>{error}</FieldError>
        </View>
      ) : null}
    </View>
  );
}
