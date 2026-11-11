import { EXERCISE_FORM, describeFormPhoto } from "@keylow/core/copy";
import { motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "../../../../lib/motion";
import { Badge } from "../../Badge";
import { Card } from "../../Card";
import { FormImage } from "../FormImage";

import type { FormPhotosProps } from "./types";

// Each photo has its turn for about a second and a half, the crossfade included.
const photoTurnMilliseconds = 1500;
const holdMilliseconds = photoTurnMilliseconds - motionDuration.standard;

function PhotoBadge({ label }: { label: string }) {
  return (
    <View className="absolute bottom-2 left-2">
      <Badge outlined>{label}</Badge>
    </View>
  );
}

// One photo at a time in a 2:1 stage: the start photo, and the end photo fading in over it and out again, in a loop.
function AlternatingPhotos({ exerciseName, startUrl, endUrl }: FormPhotosProps) {
  const endOpacity = useSharedValue(0);

  // The loop is the whole motion, so it is stopped when the card goes, and with Reduce Motion on this
  // component is not drawn at all.
  useEffect(() => {
    const fade = (toValue: number) =>
      withDelay(holdMilliseconds, withTiming(toValue, { duration: motionDuration.standard }));
    endOpacity.set(withRepeat(withSequence(fade(1), fade(0)), -1));

    return () => {
      cancelAnimation(endOpacity);
    };
  }, [endOpacity]);

  const endFadeStyle = useAnimatedStyle(() => ({ opacity: endOpacity.get() }));

  return (
    <View>
      <FormImage
        label={describeFormPhoto(exerciseName, "start")}
        sizeClassName="aspect-[2/1] w-full"
        url={startUrl}
      />
      <PhotoBadge label={EXERCISE_FORM.startLabel} />
      <View className="absolute inset-0">
        <Animated.View style={endFadeStyle} testID="form-media-end-fade">
          <FormImage
            label={describeFormPhoto(exerciseName, "end")}
            sizeClassName="aspect-[2/1] w-full"
            url={endUrl}
          />
          <PhotoBadge label={EXERCISE_FORM.endLabel} />
        </Animated.View>
      </View>
    </View>
  );
}

// Reduce Motion: both photos side by side, 3:2 each, and nothing moves.
function SideBySidePhotos({ exerciseName, startUrl, endUrl }: FormPhotosProps) {
  return (
    <View className="flex-row gap-[2px] bg-border">
      <View className="flex-1">
        <FormImage
          label={describeFormPhoto(exerciseName, "start")}
          sizeClassName="aspect-[3/2] w-full"
          url={startUrl}
        />
        <PhotoBadge label={EXERCISE_FORM.startLabel} />
      </View>
      <View className="flex-1">
        <FormImage
          label={describeFormPhoto(exerciseName, "end")}
          sizeClassName="aspect-[3/2] w-full"
          url={endUrl}
        />
        <PhotoBadge label={EXERCISE_FORM.endLabel} />
      </View>
    </View>
  );
}

/**
 * The exercise's start and end photos, for an exercise with no curated video. They take turns with a
 * crossfade, or sit side by side and still when the system asks to reduce motion.
 */
export function FormPhotos(props: FormPhotosProps) {
  const isReducedMotion = useReducedMotion();

  return (
    <Card padding={0}>
      {isReducedMotion ? <SideBySidePhotos {...props} /> : <AlternatingPhotos {...props} />}
    </Card>
  );
}
