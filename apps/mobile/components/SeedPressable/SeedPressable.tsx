import { Pressable, Text } from "react-native";

import type { SeedPressableProps } from "./types";

// Exists only to prove Storybook and its theme switch work on a device. The kit's Button (KEY-93) replaces it.
export function SeedPressable({ label, onPress }: SeedPressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="h-12 items-center justify-center rounded-medium bg-accent px-6"
    >
      <Text className="text-body-strong font-semibold text-accent-foreground">{label}</Text>
    </Pressable>
  );
}
