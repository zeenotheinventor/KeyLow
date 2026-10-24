import { BODY_MAP, describeBodyFigureLoading3d } from "@keylow/core/copy";
import { motionDuration } from "@keylow/tokens";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "../../../lib/motion";
import { ThemeScope } from "../../../lib/theme";
import { BodyView, useBody3DSupport } from "../../BodyView";
import { Text } from "../../ui";

import type { BodyStageProps } from "./types";
import type { BodyViewPhase } from "../../BodyView";

// The board's 3D viewport is 240 points high, and the body in it is 108 wide, which is 238 high.
export const BODY_STAGE_FIGURE_WIDTH = 108;

/**
 * The stage of the 3D body map: one body on a dark stage, in both themes, 240 points high. The 3D layer is
 * drawn in the dark theme, as the board's 3D layer is (`data-theme="dark"`): the backdrop, and the 3D body's
 * palette and lighting. The 2D figure that shows while the 3D body loads, or stays if it fails, sits on the clear
 * stage in the app's theme, as does "Loading 3D…" at the corner of the stage.
 * When the 3D body has drawn the backdrop darkens as the body fades in, over 220 ms, or at once with reduced motion.
 * If 3D fails the text goes, the stage stays clear, and the 2D figure stays in the same place. A tap on the 2D
 * figure is a tap while the 3D body has not drawn, and after that the 3D body takes the touch, anywhere on the
 * stage and not only on the body. A drag across the width of the body is still half a turn.
 */
export function BodyStage({ tapHandlers, label, ...figureProps }: BodyStageProps) {
  const isReducedMotion = useReducedMotion();
  const { hasFailed } = useBody3DSupport();
  const [reportedPhase, setPhase] = useState<BodyViewPhase>("loading");
  // The width the phone gives the stage, which the 3D body takes a drag and a tap across. Until it is known the
  // body takes them over its own width.
  const [stageWidth, setStageWidth] = useState(BODY_STAGE_FIGURE_WIDTH);
  // After a failure `BodyView` draws the 2D figure alone and reports nothing, so a stage drawn after one,
  // such as by switching More to 2D and back to 3D, must not wait for a report.
  const phase = hasFailed ? "failed" : reportedPhase;
  // 0 while the stage is clear, 1 once it is dark.
  const darkness = useSharedValue(0);

  useEffect(() => {
    if (phase === "drawn") {
      darkness.set(isReducedMotion ? 1 : withTiming(1, { duration: motionDuration.standard }));
    } else {
      darkness.set(0);
    }
  }, [phase, isReducedMotion, darkness]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: darkness.get() }));

  return (
    <View
      className="h-[240px] items-center justify-center overflow-hidden rounded-medium"
      onLayout={({ nativeEvent }) => {
        setStageWidth(nativeEvent.layout.width);
      }}
      {...(phase === "drawn" ? {} : tapHandlers)}
    >
      <ThemeScope className="absolute inset-0" scheme="dark">
        <View aria-hidden className="absolute inset-0" pointerEvents="none">
          {/* The animated layer takes no class, so the view in it has the stage's size and carries the colour. */}
          <Animated.View style={backdropStyle}>
            <View className="h-[240px] w-full bg-background" />
          </Animated.View>
        </View>
      </ThemeScope>
      <BodyView
        {...figureProps}
        bodyScheme="dark"
        // The 2D figure is what a screen reader meets while the 3D body loads, so its name says so.
        label={phase === "loading" ? describeBodyFigureLoading3d(label) : label}
        w={BODY_STAGE_FIGURE_WIDTH}
        touchWidth={stageWidth}
        onPhaseChange={setPhase}
      />
      {phase === "loading" ? (
        <Text className="absolute bottom-2 right-2" role="status" tone="muted" variant="caption">
          {BODY_MAP.loading3d}
        </Text>
      ) : null}
    </View>
  );
}
