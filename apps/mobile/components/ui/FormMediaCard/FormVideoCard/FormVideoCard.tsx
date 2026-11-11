import { EXERCISE_FORM, describeFormVideoLink } from "@keylow/core/copy";
import { openURL } from "expo-linking";
import { View } from "react-native";

import { Card } from "../../Card";
import { Icon } from "../../Icon";
import { PressableSurface } from "../../PressableSurface";
import { Text } from "../../Text";
import { FormImage } from "../FormImage";

import type { FormVideoCardProps } from "./types";

function PlayGlyph() {
  return (
    <View className="absolute inset-0 items-center justify-center">
      <View className="h-8 w-8 items-center justify-center rounded-pill bg-accent">
        <Icon isFilled name="Play" size="sm" tone="accent-foreground" />
      </View>
    </View>
  );
}

/**
 * The video as one pressable card: the 16:9 thumbnail with a play glyph, the title, the channel, and under a
 * hairline the line that says it opens in YouTube, as `AssistantLinkRow` draws its last line. The press opens
 * the watch address itself.
 */
export function FormVideoCard({ title, channel, thumbnailUrl, watchUrl }: FormVideoCardProps) {
  const handlePress = () => {
    // A device with no browser rejects, and there is nothing else to do about it, so the card stays as it is.
    openURL(watchUrl).catch(() => undefined);
  };

  return (
    <PressableSurface
      className="overflow-hidden rounded-large"
      label={describeFormVideoLink(title, channel)}
      role="link"
      onPress={handlePress}
    >
      <Card padding={0}>
        <View className="flex-row items-start gap-3 p-3">
          <View className="overflow-hidden rounded-medium">
            <FormImage label={title} sizeClassName="h-[72px] w-[128px]" url={thumbnailUrl}>
              <PlayGlyph />
            </FormImage>
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text numberOfLines={2} variant="body-strong">
              {title}
            </Text>
            <Text numberOfLines={1} tone="secondary" variant="caption">
              {channel}
            </Text>
          </View>
        </View>
        <View className="min-h-touch-target flex-row items-center gap-2 border-t border-border px-3">
          <Text className="flex-1" tone="accent-ink" variant="body-strong">
            {EXERCISE_FORM.opensInYouTube}
          </Text>
          <Icon name="ChevronRight" size="sm" tone="accent-ink" />
        </View>
      </Card>
    </PressableSurface>
  );
}
