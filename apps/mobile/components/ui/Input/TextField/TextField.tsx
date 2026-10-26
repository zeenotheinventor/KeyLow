import { FOOD_FORM } from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { useTheme } from "../../../../lib/theme";
import { Icon } from "../../Icon";
import { Text } from "../../Text";
import { FieldError } from "../FieldError";
import { FieldTextInput } from "../FieldTextInput";

import type { FieldMacro, TextFieldProps } from "./types";
import type { InputDensity } from "../types";
import type { TextInputProps } from "react-native";

// The classes are written out so Tailwind sees them. The food form boards draw the box 12 across, with
// 6 between the digits and the unit and 8 between a value and its lock. The sign in boards draw 16 across
// and 8 between, as the design system card does.
function boxSpacingClassName(
  density: InputDensity,
  hasUnit: boolean,
  size: NonNullable<TextFieldProps["size"]>,
): string {
  // The routine editor's cell has the digits fill the box, which is as wide as they need.
  if (size === "cell") {
    return "px-0 gap-0";
  }
  // The plate row's amount: 10 across and 8 between, with the unit.
  if (size === "sm") {
    return "px-[10px] gap-2";
  }
  if (density === "comfortable") {
    return "px-4 gap-2";
  }
  return hasUnit ? "px-3 gap-[6px]" : "px-3 gap-2";
}

const macroMarkClassName: Record<FieldMacro, string> = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
};

const alignClassName = {
  left: "",
  right: "text-right",
  center: "text-center",
} satisfies Record<NonNullable<TextFieldProps["align"]>, string>;

// The display size is the set entry boards' number: 32 over 40 in a box 64 points high. The design system has
// no type token between h1 and the numerals for it, so it is written out as the ring numeral's size is.
const boxHeightClassName = {
  default: "min-h-control-md",
  // The routine editor board's fields are 36 points high in a row of 48.
  cell: "h-control-sm",
  sm: "h-control-sm",
  display: "h-16",
} satisfies Record<NonNullable<TextFieldProps["size"]>, string>;

function valueClassName(size: NonNullable<TextFieldProps["size"]>, strongValue: boolean): string {
  if (size === "display") {
    return "text-[32px] font-semibold leading-[40px] tracking-[-0.03em]";
  }
  return strongValue ? "text-body-strong font-semibold" : "text-body font-normal";
}

// A field's text and its box give way to large text only so far, because the box is the design's 44
// points and the text has only the box to live in.
const maxFontSizeMultiplier = 1.5;
// The display number is 32 on a 40 point line in a box of 64, so it grows only a quarter before it would overflow.
const displayMaxFontSizeMultiplier = 1.25;

function nonEmpty(text: string | undefined): string | undefined {
  return text === undefined || text.trim() === "" ? undefined : text;
}

/**
 * A label, a box with a text input in it and one message under it. The box turns its border to the
 * accent while the input has focus, and to danger while there is an error. A native field has no
 * invalid state to set, so the message also describes the field, and the error is an alert.
 */
export function TextField({
  label,
  labelHidden = false,
  accessibilityLabel,
  labelHint,
  required = false,
  helper,
  helperTone,
  error,
  errorShownElsewhere = false,
  missingNote,
  disabled = false,
  dimsWhenDisabled = true,
  density = "comfortable",
  size = "default",
  inputRef,
  locked = false,
  unit,
  macro,
  align = "left",
  strongValue = false,
  adjustable,
  value,
  onChangeText,
  onBlur,
  onSubmitEditing,
  placeholder,
  ...keyboardProps
}: TextFieldProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  // An empty error is no error, so it neither flags the field nor puts an empty alert on the screen.
  const errorText = nonEmpty(error);
  const message = errorText ?? nonEmpty(helper);
  const isMessageDrawnHere =
    message !== undefined && !(errorShownElsewhere && errorText !== undefined);
  const hint = nonEmpty(labelHint);
  const note = errorText === undefined ? nonEmpty(missingNote) : undefined;
  // A native field has nothing to point at its message, so what it says is read as the field's hint: that
  // it is required (unless the error already says so), the error or the helper, then the missing note,
  // then that a locked field cannot be changed.
  const hintParts = [
    required && errorText === undefined ? FOOD_FORM.required : undefined,
    message,
    note,
    locked ? FOOD_FORM.readOnly : undefined,
  ].filter((part) => part !== undefined);
  const accessibilityHint = hintParts.length === 0 ? undefined : hintParts.join(". ");

  // The swipe up and down of a screen reader's increment and decrement, handed to the screen as a step.
  const adjustableProps: TextInputProps | undefined =
    adjustable === undefined
      ? undefined
      : {
          accessibilityRole: "adjustable",
          accessibilityValue: { text: adjustable.valueText },
          accessibilityActions: [{ name: "increment" }, { name: "decrement" }],
          onAccessibilityAction: ({ nativeEvent }) => {
            if (nativeEvent.actionName === "increment") {
              adjustable.onStep(1);
            } else if (nativeEvent.actionName === "decrement") {
              adjustable.onStep(-1);
            }
          },
        };

  const borderClassName =
    errorText !== undefined ? "border-danger" : isFocused ? "border-accent" : "border-border";
  const fillClassName = locked || disabled ? "bg-surface" : "bg-surface-raised";

  return (
    <View className={`gap-1 ${disabled && dimsWhenDisabled ? "opacity-50" : ""}`}>
      {labelHidden && hint === undefined ? null : (
        <View className="flex-row items-center justify-between gap-1">
          {labelHidden ? null : (
            <View className="min-w-0 shrink flex-row items-center gap-[6px]">
              {macro === undefined ? null : (
                <View
                  aria-hidden
                  className={`h-2 w-2 rounded-[2px] ${macroMarkClassName[macro]}`}
                />
              )}
              {/* It shrinks to the column it is in, and wraps there, so a long label at large text stays under its own field. */}
              <Text className="shrink" tone="secondary" variant="caption">
                {label}
              </Text>
            </View>
          )}
          {hint === undefined ? null : (
            <Text tone="muted" variant="caption">
              {hint}
            </Text>
          )}
        </View>
      )}
      <View
        className={`${boxHeightClassName[size]} flex-row items-center rounded-medium border ${boxSpacingClassName(density, unit !== undefined, size)} ${borderClassName} ${fillClassName}`}
      >
        <FieldTextInput
          {...keyboardProps}
          {...adjustableProps}
          accessibilityHint={accessibilityHint}
          // Left off unless disabled: on Android the accessibility state is applied after `editable`, so
          // `aria-disabled={false}` would turn a locked field's input back on.
          aria-disabled={disabled ? true : undefined}
          aria-label={accessibilityLabel ?? (unit === undefined ? label : `${label} (${unit})`)}
          className={`${size === "cell" || size === "sm" ? "min-h-0" : "min-h-10"} min-w-0 flex-1 p-0 tabular-nums text-text-primary ${valueClassName(size, strongValue)} ${alignClassName[align]}`}
          cursorColor={colors["text-primary"]}
          // `readOnly` is left out because React Native lets it override `editable` even when it is false.
          editable={!disabled && !locked}
          maxFontSizeMultiplier={
            size === "display" ? displayMaxFontSizeMultiplier : maxFontSizeMultiplier
          }
          placeholder={placeholder}
          ref={inputRef}
          placeholderTextColor={colors["text-muted"]}
          value={value}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          onChangeText={onChangeText}
          onFocus={() => {
            setIsFocused(true);
          }}
          onSubmitEditing={onSubmitEditing}
        />
        {unit === undefined ? null : (
          <Text
            aria-hidden
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            tone="muted"
            // The plate row's unit is a caption beside body digits, as the board draws it.
            variant={size === "sm" ? "caption" : "body"}
          >
            {unit}
          </Text>
        )}
        {locked ? <Icon name="Lock" size="sm" tone="muted" /> : null}
      </View>
      {!isMessageDrawnHere ? null : errorText === undefined ? (
        helperTone === "warning" ? (
          <View key="helper" className="flex-row items-center gap-1">
            <Icon name="TriangleAlert" size={16} tone="warning" />
            <Text className="shrink" tone="warning-ink" variant="caption">
              {message}
            </Text>
          </View>
        ) : (
          <Text key="helper" tone="muted" variant="caption">
            {message}
          </Text>
        )
      ) : (
        // The key remounts the message when an error replaces the helper, so the alert is announced.
        <FieldError key="error">{message}</FieldError>
      )}
      {note === undefined ? null : (
        <View className="flex-row items-center gap-1">
          <Icon name="CircleAlert" size={14} tone="warning" />
          <Text tone="warning-ink" variant="caption">
            {note}
          </Text>
        </View>
      )}
    </View>
  );
}
