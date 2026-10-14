import { FOOD_FORM } from "@keylow/core/copy";
import { useState } from "react";
import { TextInput, View } from "react-native";

import { useTheme } from "../../../../lib/theme";
import { Icon } from "../../Icon";
import { Text } from "../../Text";
import { FieldError } from "../FieldError";

import type { FieldMacro, TextFieldProps } from "./types";
import type { InputDensity } from "../types";

// The classes are written out so Tailwind sees them. The food form boards draw the box 12 across, with
// 6 between the digits and the unit and 8 between a value and its lock. The sign in boards draw 16 across
// and 8 between, as the design system card does.
function boxSpacingClassName(density: InputDensity, hasUnit: boolean): string {
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

// A field's text and its box give way to large text only so far, because the box is the design's 44
// points and the text has only the box to live in.
const maxFontSizeMultiplier = 1.5;

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
  accessibilityLabel,
  labelHint,
  helper,
  error,
  errorShownElsewhere = false,
  missingNote,
  disabled = false,
  density = "comfortable",
  locked = false,
  unit,
  macro,
  align = "left",
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
  // A native field has nothing to point at its message, so what it says is read as the field's hint: the
  // error or the helper, then the missing note, then that a locked field cannot be changed.
  const hintParts = [message, note, locked ? FOOD_FORM.readOnly : undefined].filter(
    (part) => part !== undefined,
  );
  const accessibilityHint = hintParts.length === 0 ? undefined : hintParts.join(". ");

  const borderClassName =
    errorText !== undefined ? "border-danger" : isFocused ? "border-accent" : "border-border";
  const fillClassName = locked || disabled ? "bg-surface" : "bg-surface-raised";

  return (
    <View className={`gap-1 ${disabled ? "opacity-50" : ""}`}>
      <View className="flex-row items-center justify-between gap-1">
        <View className="min-w-0 shrink flex-row items-center gap-[6px]">
          {macro === undefined ? null : (
            <View aria-hidden className={`h-2 w-2 rounded-[2px] ${macroMarkClassName[macro]}`} />
          )}
          {/* It shrinks to the column it is in, and wraps there, so a long label at large text stays under its own field. */}
          <Text className="shrink" tone="secondary" variant="caption">
            {label}
          </Text>
        </View>
        {hint === undefined ? null : (
          <Text tone="muted" variant="caption">
            {hint}
          </Text>
        )}
      </View>
      <View
        className={`min-h-control-md flex-row items-center rounded-medium border ${boxSpacingClassName(density, unit !== undefined)} ${borderClassName} ${fillClassName}`}
      >
        <TextInput
          {...keyboardProps}
          accessibilityHint={accessibilityHint}
          // Left off unless disabled: on Android the accessibility state is applied after `editable`, so
          // `aria-disabled={false}` would turn a locked field's input back on.
          aria-disabled={disabled ? true : undefined}
          aria-label={accessibilityLabel ?? (unit === undefined ? label : `${label} (${unit})`)}
          className={`min-h-10 min-w-0 flex-1 p-0 text-body font-normal tabular-nums text-text-primary ${align === "right" ? "text-right" : ""}`}
          cursorColor={colors["text-primary"]}
          // `readOnly` is left out because React Native lets it override `editable` even when it is false.
          editable={!disabled && !locked}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          placeholder={placeholder}
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
            variant="body"
          >
            {unit}
          </Text>
        )}
        {locked ? <Icon name="Lock" size="sm" tone="muted" /> : null}
      </View>
      {!isMessageDrawnHere ? null : errorText === undefined ? (
        <Text key="helper" tone="muted" variant="caption">
          {message}
        </Text>
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
