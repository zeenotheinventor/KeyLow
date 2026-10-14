import { Linking, Pressable, View } from "react-native";

import { Text } from "../../ui";

import type { FoodAttributionProps } from "./types";

// The address is one line of caption text, so it reaches the 44 point touch target by hit slop.
const addressHitSlop = { top: 14, bottom: 14 };

/**
 * The credit a source's licence asks for, under a hairline: the line and its address. The address is
 * underlined as the board draws its anchor, and opens in the browser.
 */
export function FoodAttribution({ attribution }: FoodAttributionProps) {
  return (
    <View className="gap-1 border-t border-border px-1 pt-3">
      <Text tone="secondary" variant="caption">
        {attribution.text}
      </Text>
      <Pressable
        hitSlop={addressHitSlop}
        role="link"
        onPress={() => {
          // A device with no browser rejects, and there is nothing else to do about it, so the screen stays as it is.
          Linking.openURL(attribution.url).catch(() => undefined);
        }}
      >
        <Text className="underline" tone="secondary" variant="caption">
          {attribution.url}
        </Text>
      </Pressable>
    </View>
  );
}
