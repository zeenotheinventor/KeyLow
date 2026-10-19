import { vars } from "nativewind";
import { useRef, useState } from "react";
import { View } from "react-native";

import { useTheme } from "../../../lib/theme";
import { useKeyboardLift } from "../../../lib/useKeyboardLift";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { FieldTextInput } from "../Input/FieldTextInput";

import type { SearchFieldProps } from "./types";

/**
 * The sheet's search: the Ki-Lo input with a search icon at its start and a slot at its end, docked
 * at the bottom of the screen above the keyboard. Put it last in a screen that fills the height. The
 * screen gives the bottom inset, the dock gives the 12 points above it. A screen whose field sits among
 * its content, such as the recipes tab's, places it `inline`: the field alone, with the screen's own sides.
 */
export function SearchField({
  label,
  placeholder,
  value,
  onChangeText,
  onSubmitEditing,
  autoFocus = false,
  clear,
  trailing,
  placement = "dock",
  disabled = false,
}: SearchFieldProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const dockRef = useRef<View>(null);
  // Only a docked field is at the bottom of the window, where the keyboard can cover it.
  const keyboardLift = useKeyboardLift(dockRef, placement === "dock");

  const field = (
    <View
      className={`h-control-md flex-row items-center gap-2 rounded-medium border bg-surface-raised pl-4 pr-1 ${isFocused ? "border-accent" : "border-border"} ${disabled ? "opacity-40" : ""}`}
    >
      <Icon name="Search" tone="muted" />
      <FieldTextInput
        // On Android the accessibility state is applied after `editable`, so a false one would make a
        // locked field editable again: it is only ever set when the field is disabled.
        aria-disabled={disabled ? true : undefined}
        aria-label={label}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        className="h-10 flex-1 p-0 text-body font-normal tabular-nums text-text-primary"
        cursorColor={colors["text-primary"]}
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors["text-muted"]}
        returnKeyType="search"
        role="searchbox"
        value={value}
        onBlur={() => {
          setIsFocused(false);
        }}
        onChangeText={onChangeText}
        onFocus={() => {
          setIsFocused(true);
        }}
        onSubmitEditing={onSubmitEditing}
      />
      {clear === undefined || value === "" ? null : (
        <IconButton
          icon="X"
          label={clear.label}
          size="sm"
          variant="ghost"
          onPress={clear.onPress}
        />
      )}
      {trailing}
    </View>
  );

  if (placement === "inline") {
    return field;
  }

  return (
    // The lift is the dock's own bottom padding, so the dock's spacing is on the view inside it. It is a
    // runtime value no class can name, so it goes through a variable, as the theme's colours do.
    <View
      ref={dockRef}
      className="border-t border-border bg-background pb-[var(--keyboard-lift)]"
      style={vars({ "--keyboard-lift": keyboardLift })}
    >
      <View className="px-4 pb-3 pt-2">{field}</View>
    </View>
  );
}
