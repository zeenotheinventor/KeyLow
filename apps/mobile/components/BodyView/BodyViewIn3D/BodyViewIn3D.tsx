import { motionDuration } from "@keylow/tokens";
import { vars } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "../../../lib/motion";
import { Body3D, BodyFigure } from "../../ui";

import type { BodyViewIn3DProps, Phase } from "./types";

// How long the 3D body has to draw its first frame before the 2D figure is kept for good.
const FIRST_FRAME_TIMEOUT_MILLISECONDS = 3000;

// The opacity of the 3D layer while it loads. See `bodyStyle`.
const HIDDEN_BODY_OPACITY = 0.01;

/**
 * The 2D figure with the 3D body loading over it, in the one box. The 2D figure draws at once. When the
 * 3D body reports its first frame the 2D figure fades out as the 3D body fades in over 220 ms, with
 * no fade when the person has asked for reduced motion. If there is no first frame in 3 seconds, or the 3D body fails, the 2D figure
 * stays, with no message, and `onFail` is called. The box keeps the 2D figure's size throughout, and a
 * screen reader finds one image with the label: the 2D figure until the 3D body has drawn, then the 3D.
 */
export function BodyViewIn3D({
  onFail,
  Body3DComponent = Body3D,
  ...figureProps
}: BodyViewIn3DProps) {
  const { label, w } = figureProps;
  const isReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("loading");
  // 0 while the 2D figure shows, 1 once the 3D body has taken its place.
  const progress = useSharedValue(0);

  const fail = useCallback(() => {
    setPhase("failed");
    onFail();
  }, [onFail]);
  const showDrawn = useCallback(() => {
    setPhase((current) => (current === "loading" ? "drawn" : current));
  }, []);

  useEffect(() => {
    if (phase !== "loading") {
      return;
    }
    const timer = setTimeout(fail, FIRST_FRAME_TIMEOUT_MILLISECONDS);
    return () => {
      clearTimeout(timer);
    };
  }, [phase, fail]);

  useEffect(() => {
    if (phase === "drawn") {
      progress.set(isReducedMotion ? 1 : withTiming(1, { duration: motionDuration.standard }));
    } else {
      progress.set(0);
    }
  }, [phase, isReducedMotion, progress]);

  const figureStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));
  // Never fully clear, because a GL view at alpha 0 may not draw on Android, and then it would never report
  // a first frame. At 0.01 it draws and cannot be seen.
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: HIDDEN_BODY_OPACITY + (1 - HIDDEN_BODY_OPACITY) * progress.get(),
  }));
  const isDrawn = phase === "drawn";

  return (
    <View className="w-[var(--body-width)]" style={vars({ "--body-width": w })}>
      {/* In the flow, so it gives the box its size, and it stays under the 3D body for good. */}
      <Animated.View
        aria-hidden={isDrawn}
        pointerEvents={isDrawn ? "none" : "auto"}
        style={figureStyle}
      >
        <BodyFigure {...figureProps} />
      </Animated.View>
      {phase === "failed" ? null : (
        <View aria-hidden={!isDrawn} className="absolute inset-0" pointerEvents="none">
          <Animated.View style={bodyStyle}>
            <Body3DComponent label={label} onError={fail} onFirstFrame={showDrawn} w={w} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}
