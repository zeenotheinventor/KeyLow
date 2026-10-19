import { useContext, useState } from "react";
import { TextInput, View } from "react-native";

import { useTheme } from "../../../lib/theme";
import { IsInsideSheetContext, SheetTextInput } from "../BottomSheet";
import { FieldError } from "../Input";
import { Text } from "../Text";

import type { TextAreaProps } from "./types";
import type { TextInputProps } from "react-native";

// The box is the design's multi-line field: at least 96 points, 12 across and 10 down, growing with the
// text to six lines of the 24 point body type (144 points) and scrolling inside from there.
const maxInputHeight = "max-h-[144px]";

// A field's text and its box give way to large text only so far, as the single line field's do.
const maxFontSizeMultiplier = 1.5;

function nonEmpty(text: string | undefined): string | undefined {
  return text === undefined || text.trim() === "" ? undefined : text;
}

/**
 * A multi-line field: the single line `Input`'s box and border, taller, with a count under its end and one
 * message under its start. The box turns its border to the accent while the input has focus, and to
 * danger while there is an error. A native field has no invalid state to set, so the error also describes
 * the field, and it is an alert.
 */
export function TextArea({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  autoFocus,
  counter,
  isOverLimit = false,
  error,
  disabled = false,
}: TextAreaProps) {
  const { colors } = useTheme();
  const isInsideSheet = useContext(IsInsideSheetContext);
  const [isFocused, setIsFocused] = useState(false);

  // An empty error is no error, so it neither flags the field nor puts an empty alert on the screen.
  const errorText = nonEmpty(error);
  const borderClassName =
    errorText !== undefined ? "border-danger" : isFocused ? "border-accent" : "border-border";

  const inputProps = {
    accessibilityHint: errorText,
    // Left off unless disabled: on Android the accessibility state is applied after `editable`, so
    // `aria-disabled={false}` would turn a locked field's input back on.
    "aria-disabled": disabled ? true : undefined,
    "aria-label": label,
    autoFocus,
    className: `min-h-[76px] min-w-0 p-0 text-body font-normal text-text-primary ${maxInputHeight}`,
    cursorColor: colors["text-primary"],
    editable: !disabled,
    maxFontSizeMultiplier,
    multiline: true,
    placeholder,
    placeholderTextColor: colors["text-muted"],
    textAlignVertical: "top",
    value,
    onBlur: (event: Parameters<NonNullable<TextAreaProps["onBlur"]>>[0]) => {
      setIsFocused(false);
      onBlur?.(event);
    },
    onChangeText,
    onFocus: () => {
      setIsFocused(true);
    },
  } satisfies TextInputProps;

  return (
    <View className={`gap-1 ${disabled ? "opacity-50" : ""}`}>
      <View
        className={`min-h-[96px] rounded-medium border bg-surface-raised px-3 py-[10px] ${borderClassName}`}
      >
        {isInsideSheet ? <SheetTextInput {...inputProps} /> : <TextInput {...inputProps} />}
      </View>
      {errorText === undefined && counter === undefined ? null : (
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            {errorText === undefined ? null : <FieldError key="error">{errorText}</FieldError>}
          </View>
          {counter === undefined ? null : (
            <Text
              className="tabular-nums"
              tone={isOverLimit ? "danger" : "muted"}
              variant="caption"
            >
              {counter}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
