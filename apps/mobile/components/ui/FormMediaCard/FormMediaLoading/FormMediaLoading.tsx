import { EXERCISE_FORM } from "@keylow/core/copy";
import { skeletonDelay } from "@keylow/tokens";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useFadeInStyle } from "../../../../lib/motion";
import { Card } from "../../Card";
import { SkeletonBone } from "../../Skeleton/SkeletonBone";

/**
 * The skeleton of the video card: the thumbnail, a title of two lines and the channel, and the trailing line.
 * It draws nothing for the first 200 ms, like every skeleton, so a quick read never flickers.
 */
export function FormMediaLoading() {
  const animatedStyle = useFadeInStyle(skeletonDelay);

  return (
    <View accessible aria-label={EXERCISE_FORM.loadingName} role="status">
      <Animated.View style={animatedStyle}>
        <Card padding={0}>
          <View className="flex-row items-start gap-3 p-3">
            <SkeletonBone className="h-[72px] w-[128px] shrink-0 rounded-medium" />
            <View className="flex-1 gap-2 pt-1">
              <SkeletonBone className="h-[14px] w-[90%]" />
              <SkeletonBone className="h-[14px] w-[62%]" />
              <SkeletonBone className="mt-1 h-[10px] w-[38%]" />
            </View>
          </View>
          <View className="min-h-touch-target justify-center border-t border-border px-3">
            <SkeletonBone className="h-3 w-[120px]" />
          </View>
        </Card>
      </Animated.View>
    </View>
  );
}
