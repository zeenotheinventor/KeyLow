import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useFadeInStyle } from "../../../lib/motion";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { Text } from "../Text";

import type { EmptyStateProps } from "./types";

/**
 * What fills a view when there is nothing to show: a muted icon in a tile, a title, a sentence and an
 * optional action. It fills the height of its parent and sits in the middle of it, as the boards draw it.
 * The copy is the screen's, from `@keylow/core/copy`. It fades in once, in place of the design's cut-in.
 */
export function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  const animatedStyle = useFadeInStyle();

  // A class and an animated style cannot share an element, so the fade sits on a wrapper with no class,
  // inside the view that fills the parent.
  return (
    <View className="flex-1 justify-center">
      <Animated.View style={animatedStyle} testID="empty-state">
        <View className="items-center gap-2 px-6">
          <View
            className="mb-2 h-[56px] w-[56px] items-center justify-center rounded-medium bg-surface-raised"
            testID="empty-state-tile"
          >
            <Icon name={icon} size="xl" tone="muted" />
          </View>
          <Text className="text-center" role="heading" variant="h2">
            {title}
          </Text>
          {body === undefined ? null : (
            <Text className="text-center" tone="secondary">
              {body}
            </Text>
          )}
          {action === undefined ? null : (
            <Button
              className="mt-3"
              icon={action.icon}
              variant="secondary"
              onPress={action.onPress}
            >
              {action.label}
            </Button>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
