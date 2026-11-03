import { ASSISTANT_MAX_TEXT_LENGTH } from "@keylow/core";
import { ASSISTANT_SHEET } from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { useTheme } from "../../../lib/theme";
import { Icon, PressableSurface, SheetTextInput } from "../../ui";

import type { ComposerProps } from "./types";

// A field's text gives way to large text only so far, as the kit's fields do.
const maxFontSizeMultiplier = 1.5;

/**
 * The message field and the round Send button under the thread, as the boards draw them: a multi-line field
 * that grows to six lines and then scrolls, and a 44 point accent circle with an arrow. The field is the
 * sheet library's own input, so the sheet lifts above the keyboard. Nothing past the cap can be typed.
 */
export function Composer({
  value,
  onChangeText,
  onSend,
  isSendDisabled,
  isFieldDisabled,
  placeholder,
  isAutoFocused = false,
}: ComposerProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="flex-row items-end gap-2">
      <View
        className={`min-h-control-md min-w-0 flex-1 justify-center rounded-medium border bg-surface-raised px-[14px] py-[10px] ${isFocused ? "border-accent" : "border-border"} ${isFieldDisabled ? "opacity-40" : ""}`}
      >
        <SheetTextInput
          // Left off unless disabled: on Android the accessibility state is applied after `editable`, so
          // `aria-disabled={false}` would turn a locked field's input back on.
          aria-disabled={isFieldDisabled ? true : undefined}
          aria-label={ASSISTANT_SHEET.composerLabel}
          autoFocus={isAutoFocused}
          className="max-h-[144px] min-w-0 p-0 text-body font-normal text-text-primary"
          cursorColor={colors["text-primary"]}
          editable={!isFieldDisabled}
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          maxLength={ASSISTANT_MAX_TEXT_LENGTH}
          multiline
          placeholder={placeholder}
          placeholderTextColor={colors["text-muted"]}
          value={value}
          onBlur={() => {
            setIsFocused(false);
          }}
          onChangeText={onChangeText}
          onFocus={() => {
            setIsFocused(true);
          }}
        />
      </View>
      <PressableSurface
        className={`h-touch-target w-touch-target items-center justify-center rounded-pill bg-accent ${isSendDisabled ? "opacity-40" : ""}`}
        disabled={isSendDisabled}
        label={ASSISTANT_SHEET.sendLabel}
        onPress={onSend}
      >
        <Icon name="ArrowUp" tone="accent-foreground" />
      </PressableSurface>
    </View>
  );
}
