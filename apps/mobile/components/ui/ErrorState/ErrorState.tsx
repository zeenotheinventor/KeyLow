import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useFadeInStyle } from "../../../lib/motion";
import { Button } from "../Button";
import { Card } from "../Card";
import { Icon } from "../Icon";
import { Text } from "../Text";

import type { ErrorStateProps } from "./types";

/**
 * What fills a view when a load failed: a danger-tinted tile, a title, a sentence and an optional retry.
 * It fills the height of its parent and sits in the middle of it, as the boards draw it, unless it is `section`,
 * or a `card`, which takes the height of its words and sits among the other cards of a screen, as `EmptyState`'s
 * card does. The copy is the screen's, from `@keylow/core/copy`. It is an alert and an assertive live region, because the alert
 * role alone does not announce on mount on Android, so a screen reader says it as it appears. It fades in
 * once, in place of the design's cut-in.
 */
export function ErrorState({
  title,
  body,
  retry,
  action,
  inset = "default",
  size = "fill",
  variant = "page",
}: ErrorStateProps) {
  const animatedStyle = useFadeInStyle();
  const isCard = variant === "card";

  // A class and an animated style cannot share an element, so the fade sits on a wrapper with no class,
  // inside the view that fills the parent. The alert is the words only: a group is read as one, so the
  // retry stays outside it, where a screen reader can reach it.
  const words = (
    <View
      className={`items-center gap-2 ${isCard ? "px-5 pb-4 pt-5" : inset === "wide" ? "px-8" : "px-6"}`}
    >
      <View
        className="mb-2 h-[56px] w-[56px] items-center justify-center rounded-medium bg-danger-muted"
        testID="error-state-tile"
      >
        <Icon name="TriangleAlert" size="xl" tone="danger" />
      </View>
      <View accessible aria-live="assertive" className="items-center gap-2" role="alert">
        <Text className="text-center" variant="h2">
          {title}
        </Text>
        {body === undefined ? null : (
          <Text className="text-center" tone="secondary">
            {body}
          </Text>
        )}
      </View>
      {retry !== undefined ? (
        <Button
          className={isCard ? "mt-2" : "mt-3"}
          icon="RotateCw"
          variant="secondary"
          onPress={retry.onPress}
        >
          {retry.label}
        </Button>
      ) : action === undefined ? null : (
        <Button
          className={isCard ? "mt-2" : "mt-3"}
          variant={action.variant ?? "secondary"}
          onPress={action.onPress}
        >
          {action.label}
        </Button>
      )}
    </View>
  );

  return isCard ? (
    <Animated.View style={animatedStyle} testID="error-state">
      <Card padding={0}>{words}</Card>
    </Animated.View>
  ) : (
    <View className={size === "fill" ? "flex-1 justify-center" : "py-4"}>
      <Animated.View style={animatedStyle} testID="error-state">
        {words}
      </Animated.View>
    </View>
  );
}
