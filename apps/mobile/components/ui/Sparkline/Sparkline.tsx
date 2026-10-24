import { Circle, Path } from "@shopify/react-native-skia";
import { View } from "react-native";

import {
  latestIndex,
  lineRuns,
  lonePoints,
  plotPoints,
  runPath,
  valueDomain,
} from "../../../lib/chart/linePlot";
import { strokePaint } from "../../../lib/skia/strokePaint";
import { StyledCanvas } from "../../../lib/skia/StyledCanvas";
import { useTheme } from "../../../lib/theme";

import type { SparklineProps, SparklineSize, SparklineTone } from "./types";
import type { ColorName } from "@keylow/tokens";

type SizeSpec = {
  /** Written out in full so Tailwind sees it. */
  canvasClassName: string;
  width: number;
  height: number;
  // Room all round for the line's width and the dot, so neither is cut off at the edge of the canvas.
  inset: number;
  lineWidth: number;
  dotRadius: number;
  // A reading with no line to its neighbours, which is still seen, smaller than the latest reading's dot.
  loneDotRadius: number;
  // The width of the ring in the surface colour around the latest dot, or 0 for none.
  ringWidth: number;
};

const sizes: Record<SparklineSize, SizeSpec> = {
  default: {
    canvasClassName: "h-5 w-16",
    width: 64,
    height: 20,
    inset: 3,
    lineWidth: 1.5,
    dotRadius: 2,
    loneDotRadius: 1.5,
    ringWidth: 0,
  },
  wide: {
    canvasClassName: "h-[40px] w-[128px]",
    width: 128,
    height: 40,
    inset: 4,
    lineWidth: 2,
    dotRadius: 3.5,
    loneDotRadius: 2,
    ringWidth: 2,
  },
};

const toneColours: Record<SparklineTone, { line: ColorName; dot: ColorName }> = {
  neutral: { line: "chart-trend", dot: "chart-marker" },
  positive: { line: "success-ink", dot: "success-ink" },
  negative: { line: "danger", dot: "danger" },
};

/**
 * A small line of a trend for a row, with a dot on the latest reading. A skipped week breaks the line and has
 * no point, and a reading with a skipped week either side is a smaller dot alone. It is an image named by the label,
 * or decoration a screen reader skips when the row's own text says the same.
 */
export function Sparkline({
  points,
  label,
  decorative = false,
  tone = "neutral",
  size = "default",
}: SparklineProps) {
  const { colors } = useTheme();
  const spec = sizes[size];
  const area = {
    left: spec.inset,
    top: spec.inset,
    width: spec.width - 2 * spec.inset,
    height: spec.height - 2 * spec.inset,
  };

  const placed = plotPoints(points, area, valueDomain(points));
  const latestWeek = latestIndex(points);
  const latest = placed.find((point) => point?.index === latestWeek);
  const accessibility = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ accessible: true, role: "img", "aria-label": label } as const);

  return (
    <View {...accessibility}>
      <StyledCanvas className={spec.canvasClassName}>
        {lineRuns(placed).map((run) => (
          <Path
            color={colors[toneColours[tone].line]}
            key={run[0]?.index}
            path={runPath(run)}
            strokeCap="round"
            strokeJoin="round"
            strokeWidth={spec.lineWidth}
            {...strokePaint}
          />
        ))}
        {lonePoints(placed)
          .filter((point) => point.index !== latestWeek)
          .map((point) => (
            <Circle
              color={colors[toneColours[tone].line]}
              cx={point.x}
              cy={point.y}
              key={point.index}
              r={spec.loneDotRadius}
            />
          ))}
        {latest !== undefined && latest !== null && (
          <Circle
            color={colors[toneColours[tone].dot]}
            cx={latest.x}
            cy={latest.y}
            r={spec.dotRadius}
          />
        )}
        {latest !== undefined && latest !== null && spec.ringWidth > 0 && (
          <Circle
            color={colors.surface}
            cx={latest.x}
            cy={latest.y}
            r={spec.dotRadius}
            strokeWidth={spec.ringWidth}
            {...strokePaint}
          />
        )}
      </StyledCanvas>
    </View>
  );
}
