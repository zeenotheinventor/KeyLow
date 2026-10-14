import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useFadeInStyle } from "../../../lib/motion";
import { Button } from "../Button";
import { Icon } from "../Icon";
import { Text } from "../Text";

import type { ErrorStateProps } from "./types";

/**
 * What fills a view when a load failed: a danger-tinted tile, a title, a sentence and an optional retry.
 * It fills the height of its parent and sits in the middle of it, as the boards draw it. The copy is the
 * screen's, from `@keylow/core/copy`. It is an alert and an assertive live region, because the alert
 * role alone does not announce on mount on Android, so a screen reader says it as it appears. It fades in
 * once, in place of the design's cut-in.
 */
export function ErrorState({ title, body, retry }: ErrorStateProps) {
  const animatedStyle = useFadeInStyle();

  // A class and an animated style cannot share an element, so the fade sits on a wrapper with no class,
  // inside the view that fills the parent. The alert is the words only: a group is read as one, so the
  // retry stays outside it, where a screen reader can reach it.
  return (
    <View className="flex-1 justify-center">
      <Animated.View style={animatedStyle} testID="error-state">
        <View className="items-center gap-2 px-6">
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
          {retry === undefined ? null : (
            <Button className="mt-3" icon="RotateCw" variant="secondary" onPress={retry.onPress}>
              {retry.label}
            </Button>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
