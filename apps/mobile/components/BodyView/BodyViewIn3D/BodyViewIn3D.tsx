import { motionDuration } from "@keylow/tokens";
import { vars } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "../../../lib/motion";
import { ThemeScope } from "../../../lib/theme";
import { Body3D, BodyFigure } from "../../ui";

import type { BodyViewPhase } from "../types";
import type { BodyViewIn3DProps } from "./types";

// How long the 3D body has to draw its first frame before the 2D figure is kept for good. The first load on
// Hermes reads the model and compiles the shaders, which can take several seconds on a slow phone.
const FIRST_FRAME_TIMEOUT_MILLISECONDS = 8000;

// The opacity of the 3D layer while it loads. See `bodyStyle`.
const HIDDEN_BODY_OPACITY = 0.01;

/**
 * The 2D figure with the 3D body loading over it, in the one box. The 2D figure draws at once. When the
 * 3D body reports its first frame the 2D figure fades out as the 3D body fades in over 220 ms, with
 * no fade when the person has asked for reduced motion. If there is no first frame in 8 seconds, or the 3D body fails, the 2D figure
 * stays, with no message, and `onFail` is called. The box keeps the 2D figure's size throughout, and a
 * screen reader finds one image with the label: the 2D figure until the 3D body has drawn, then the 3D.
 * The 3D body gets the figure's value props, the side it faces and the two calls that only it makes, and
 * takes touches once it has drawn. With `bodyScheme` the 3D body alone is drawn in that scheme, and the 2D figure keeps the app's. `onPhaseChange` tells the stage around it where it is.
 */
export function BodyViewIn3D({
  onFail,
  Body3DComponent = Body3D,
  onSideChange,
  onTap,
  onPhaseChange,
  bodyScheme,
  ...figureProps
}: BodyViewIn3DProps) {
  const { label, w, side, scale, values, selected, dim = 1, unselectedOpacity = 1 } = figureProps;
  const isReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<BodyViewPhase>("loading");
  // 0 while the 2D figure shows, 1 once the 3D body has taken its place.
  const progress = useSharedValue(0);

  // Told at once, because `onFail` may take this component away before an effect could say it.
  const fail = useCallback(() => {
    setPhase("failed");
    onPhaseChange?.("failed");
    onFail();
  }, [onFail, onPhaseChange]);
  const showDrawn = useCallback(() => {
    setPhase((current) => (current === "loading" ? "drawn" : current));
  }, []);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

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
  const body3D = (
    <Body3DComponent
      dim={dim}
      label={label}
      scale={scale}
      selected={selected}
      side={side}
      unselectedOpacity={unselectedOpacity}
      values={values}
      w={w}
      onError={fail}
      onFirstFrame={showDrawn}
      onSideChange={onSideChange}
      onTap={onTap}
    />
  );

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
        // Once the 3D body has drawn it is the one that takes the touch, to turn and to tap. While it loads,
        // the 2D figure is under it and nothing is drawn to touch.
        <View
          aria-hidden={!isDrawn}
          className="absolute inset-0"
          pointerEvents={isDrawn ? "auto" : "none"}
        >
          <Animated.View style={bodyStyle}>
            {bodyScheme === undefined ? (
              body3D
            ) : (
              <ThemeScope scheme={bodyScheme}>{body3D}</ThemeScope>
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}
