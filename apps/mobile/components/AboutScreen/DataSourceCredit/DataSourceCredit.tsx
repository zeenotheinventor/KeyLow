import { Linking, Pressable, View } from "react-native";

import { Card, Text } from "../../ui";

import type { DataSourceCreditProps } from "./types";

// The address is a line or two of caption text, so it reaches the 44 point touch target by hit slop.
const addressHitSlop = { top: 14, bottom: 14 };

/**
 * One source's credit on a card: its name, the statement its licence asks for and its address, which is
 * underlined as a link and opens in the browser.
 */
export function DataSourceCredit({ name, text, url }: DataSourceCreditProps) {
  return (
    <Card>
      <View className="gap-2">
        <Text variant="body-strong">{name}</Text>
        <Text tone="secondary">{text}</Text>
        <Pressable
          hitSlop={addressHitSlop}
          role="link"
          onPress={() => {
            // A device with no browser rejects, and there is nothing else to do about it, so the screen stays as it is.
            Linking.openURL(url).catch(() => undefined);
          }}
        >
          <Text className="underline" tone="secondary" variant="caption">
            {url}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
