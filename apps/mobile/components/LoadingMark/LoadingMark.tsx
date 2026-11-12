import { memo, useEffect } from "react";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line } from "react-native-svg";

import { loadingMarkPose } from "./loadingMarkPose";
import { useReducedMotion } from "../../lib/motion";
import { useTheme } from "../../lib/theme";
import { KiLoMark } from "../KiLoMark";

import type { LoadingMarkProps } from "./types";

const LOOP_MILLISECONDS = 2200;
// The loop's first drawn frame is the complete logo, which is 0.72 of the way through the pose.
const FIRST_FRAME_POSITION = 0.72;
const STROKE_WIDTH = 22;
// The second arc starts where the first one's dash pattern repeats, 327 units round the circle.
const ARC_ONE_DEGREES = -9;
const ARC_TWO_DEGREES = ARC_ONE_DEGREES + (327 / 100) * (180 / Math.PI);

// react-native-svg reads a `transform` string and a `strokeDasharray` string in its JavaScript, which an
// animated prop skips. So the lines move by their end points, the dash is a pair of numbers and the arcs'
// rotation is never animated.
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

// Every part starts at the logo's rest drawing, so the first frame is the logo before the UI thread
// writes anything.
function AnimatedLoadingMark({ size }: LoadingMarkProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withRepeat(withTiming(1, { duration: LOOP_MILLISECONDS, easing: Easing.linear }), -1),
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  const pose = useDerivedValue(() => loadingMarkPose((progress.get() + FIRST_FRAME_POSITION) % 1));

  const barProps = useAnimatedProps(() => pose.get().bar);
  const plateOneProps = useAnimatedProps(() => pose.get().plateOne);
  const plateTwoProps = useAnimatedProps(() => pose.get().plateTwo);
  const arcOneProps = useAnimatedProps(() => {
    const { length, offset, opacity } = pose.get().arcOne;
    return { strokeDasharray: [length, 1000], strokeDashoffset: offset, opacity };
  });
  const arcTwoProps = useAnimatedProps(() => {
    const { length, offset, opacity } = pose.get().arcTwo;
    return { strokeDasharray: [length, 1000], strokeDashoffset: offset, opacity };
  });

  const line = {
    stroke: colors["text-primary"],
    strokeWidth: STROKE_WIDTH,
    strokeLinecap: "round",
  } as const;
  const arc = {
    cx: 128,
    cy: 128,
    fill: "none",
    r: 100,
    stroke: colors.accent,
    strokeDasharray: [205, 1000],
    strokeLinecap: "round",
    strokeWidth: STROKE_WIDTH,
  } as const;

  return (
    <Svg aria-hidden height={size} viewBox="0 0 256 256" width={size}>
      <AnimatedLine animatedProps={barProps} x1={72} x2={184} y1={184} y2={72} {...line} />
      <AnimatedLine animatedProps={plateOneProps} x1={150} x2={196} y1={60} y2={106} {...line} />
      <AnimatedLine animatedProps={plateTwoProps} x1={60} x2={106} y1={150} y2={196} {...line} />
      <AnimatedCircle
        animatedProps={arcOneProps}
        transform={`rotate(${ARC_ONE_DEGREES} 128 128)`}
        {...arc}
      />
      <AnimatedCircle
        animatedProps={arcTwoProps}
        transform={`rotate(${ARC_TWO_DEGREES} 128 128)`}
        {...arc}
      />
    </Svg>
  );
}

/**
 * The Ki-Lo logo as the loading mark, "Loading the bar": plates slide onto the bar one at a time and each
 * draws its half of the ring, then the plates come off and it starts again. With reduced motion it is the
 * still logo. The setting is read here and not in the animated child, so the child's hooks are never
 * conditional, and turning the setting on unmounts the child and stops its loop. The loop is one shared
 * value on the UI thread, so a frame re-renders nothing, and `memo` keeps a re-render of the thread from
 * touching it. The mark is decoration and hidden from screen readers.
 */
export const LoadingMark = memo(function LoadingMark({ size }: LoadingMarkProps) {
  const isReducedMotion = useReducedMotion();

  return isReducedMotion ? <KiLoMark size={size} /> : <AnimatedLoadingMark size={size} />;
});
