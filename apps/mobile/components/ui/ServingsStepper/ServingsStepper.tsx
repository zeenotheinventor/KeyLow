import { View } from "react-native";

import { IconButton } from "../IconButton";
import { FieldError } from "../Input";
import { NumericInput } from "../NumericInput";
import { Text } from "../Text";

import type { ServingsStepperProps } from "./types";

/**
 * A number of servings in a row: the label on the left, then a minus button, a 72 point field and a plus
 * button on the right, on the `DayStepper` pattern. A button that cannot act is dimmed and disabled, a
 * step plays the selection haptic, and the field is an adjustable that a swipe up or down steps by one.
 * It holds no rules: it does not validate or clamp, and the caller keeps the text.
 */
export function ServingsStepper({
  label,
  decreaseLabel,
  increaseLabel,
  text,
  valueText,
  onChangeText,
  onStep,
  canDecrease,
  canIncrease,
  error,
  fieldRef,
  onBlur,
  disabled = false,
  className = "",
}: ServingsStepperProps) {
  const isDecreaseDisabled = disabled || !canDecrease;
  const isIncreaseDisabled = disabled || !canIncrease;

  // A swipe does what the button beside it does, so it is as unavailable as that button.
  const stepBySwipe = (direction: 1 | -1) => {
    if (direction === 1 ? !isIncreaseDisabled : !isDecreaseDisabled) {
      onStep(direction);
    }
  };

  return (
    <View className={`gap-2 ${className}`}>
      <View className="flex-row items-center justify-between gap-3">
        {/* The field is named by the label, so a screen reader is not told it twice. */}
        <Text aria-hidden variant="body-strong">
          {label}
        </Text>
        <View className="flex-row items-center gap-2">
          <IconButton
            disabled={isDecreaseDisabled}
            haptic="select"
            icon="Minus"
            label={decreaseLabel}
            onPress={() => {
              onStep(-1);
            }}
          />
          <View className="w-[72px]">
            <NumericInput
              adjustable={{ valueText, onStep: stepBySwipe }}
              align="center"
              disabled={disabled}
              error={error}
              errorShownElsewhere
              inputRef={fieldRef}
              keyboardType="number-pad"
              label={label}
              labelHidden
              placeholder=""
              strongValue
              value={text}
              onBlur={() => onBlur?.()}
              onChangeText={onChangeText}
            />
          </View>
          <IconButton
            disabled={isIncreaseDisabled}
            haptic="select"
            icon="Plus"
            label={increaseLabel}
            onPress={() => {
              onStep(1);
            }}
          />
        </View>
      </View>
      {error === undefined || error === "" ? null : (
        <FieldError className="self-end text-right">{error}</FieldError>
      )}
    </View>
  );
}
