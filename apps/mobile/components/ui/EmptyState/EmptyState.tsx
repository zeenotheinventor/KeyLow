import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useFadeInStyle } from "../../../lib/motion";
import { Button } from "../Button";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { Text } from "../Text";

import type { EmptyStateAction, EmptyStateProps } from "./types";

function renderAction(
  action: EmptyStateAction,
  { className = "", isFullWidth = false }: { className?: string; isFullWidth?: boolean },
) {
  return (
    <Button
      className={className}
      disabled={action.disabled ?? false}
      fullWidth={isFullWidth}
      icon={action.icon}
      variant={action.variant ?? "secondary"}
      onPress={action.onPress}
    >
      {action.label}
    </Button>
  );
}

/**
 * What fills a view when there is nothing to show: a muted icon in a tile, a title, a sentence and an
 * optional action, or two. It fills the height of its parent and sits in the middle of it, as the boards draw it,
 * unless it is a `card`, which takes the height of its words and sits among the other cards of a screen.
 * The copy is the screen's, from `@keylow/core/copy`. It fades in once, in place of the design's cut-in.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  secondaryAction,
  inset = "default",
  variant = "page",
}: EmptyStateProps) {
  const animatedStyle = useFadeInStyle();
  const isCard = variant === "card";

  const words = (
    <View
      className={`items-center gap-2 ${isCard ? "px-5 pb-4 pt-5" : inset === "wide" ? "px-8" : "px-6"}`}
    >
      {icon === undefined ? null : (
        <View
          className="mb-2 h-[56px] w-[56px] items-center justify-center rounded-medium bg-surface-raised"
          testID="empty-state-tile"
        >
          <Icon name={icon} size="xl" tone="muted" />
        </View>
      )}
      <Text className="text-center" role="heading" variant="h2">
        {title}
      </Text>
      {body === undefined ? null : (
        <Text className="text-center" tone="secondary">
          {body}
        </Text>
      )}
      {action === undefined ? null : secondaryAction === undefined ? (
        renderAction(action, { className: isCard ? "mt-2" : "mt-3" })
      ) : (
        // The two buttons run the width of the words, 8 points apart with 16 above, as the empty Weight board draws them.
        <View className={`w-full gap-2 ${isCard ? "mt-2" : "mt-4"}`}>
          {renderAction(action, { isFullWidth: true })}
          {renderAction(secondaryAction, { isFullWidth: true })}
        </View>
      )}
    </View>
  );

  // A class and an animated style cannot share an element, so the fade sits on a wrapper with no class,
  // inside the view that fills the parent.
  return isCard ? (
    <Animated.View style={animatedStyle} testID="empty-state">
      <Card padding={0}>{words}</Card>
    </Animated.View>
  ) : (
    <View className="flex-1 justify-center">
      <Animated.View style={animatedStyle} testID="empty-state">
        {words}
      </Animated.View>
    </View>
  );
}
