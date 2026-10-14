import { vars } from "nativewind";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";

import { useTheme } from "../../../lib/theme";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { useKeyboardLift } from "./useKeyboardLift";

import type { SearchFieldProps } from "./types";

/**
 * The sheet's search: the Ki-Lo input with a search icon at its start and a slot at its end, docked
 * at the bottom of the screen above the keyboard. Put it last in a screen that fills the height. The
 * screen gives the bottom inset, the dock gives the 12 points above it.
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
}: SearchFieldProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const dockRef = useRef<View>(null);
  const keyboardLift = useKeyboardLift(dockRef);

  return (
    // The lift is the dock's own bottom padding, so the dock's spacing is on the view inside it. It is a
    // runtime value no class can name, so it goes through a variable, as the theme's colours do.
    <View
      ref={dockRef}
      className="border-t border-border bg-background pb-[var(--keyboard-lift)]"
      style={vars({ "--keyboard-lift": keyboardLift })}
    >
      <View className="px-4 pb-3 pt-2">
        <View
          className={`h-control-md flex-row items-center gap-2 rounded-medium border bg-surface-raised pl-4 pr-1 ${isFocused ? "border-accent" : "border-border"}`}
        >
          <Icon name="Search" tone="muted" />
          <TextInput
            aria-label={label}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={autoFocus}
            className="h-10 flex-1 p-0 text-body font-normal tabular-nums text-text-primary"
            cursorColor={colors["text-primary"]}
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
      </View>
    </View>
  );
}
