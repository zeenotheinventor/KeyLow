import { Text as NativeText, View } from "react-native";

import { PressableSurface, Text } from "../ui";

import type { BodyCompositionPromptProps } from "./types";

/**
 * The stacked compact prompt that `connected · partial` draws: a sentence over a text button, 12 points of
 * padding above and 4 below. The action is a 36 point line with its 44 point touch target as a minimum
 * height, and it sits 4 points left of the sentence's edge so its label lines up with it.
 */
export function BodyCompositionPrompt({ text, action, onAction }: BodyCompositionPromptProps) {
  return (
    // A plain surface and not the kit's Card, whose elevation the board does not draw on this prompt.
    <View className="gap-[2px] rounded-large border border-border bg-surface px-4 pb-1 pt-3">
      <NativeText className="text-label-small font-normal tabular-nums text-text-secondary">
        {text}
      </NativeText>
      <PressableSurface
        className="-mx-1 min-h-touch-target justify-center self-start px-1"
        onPress={onAction}
      >
        <Text tone="accent-ink" variant="label-small">
          {action}
        </Text>
      </PressableSurface>
    </View>
  );
}
