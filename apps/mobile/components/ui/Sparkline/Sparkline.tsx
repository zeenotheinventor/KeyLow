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

import type { SparklineProps, SparklineTone } from "./types";
import type { ColorName } from "@keylow/tokens";

const WIDTH = 64;
const HEIGHT = 20;
// Room all round for the line's width and the dot, so neither is cut off at the edge of the canvas.
const INSET = 3;
const LINE_WIDTH = 1.5;
const DOT_RADIUS = 2;
// A reading with no line to its neighbours, which is still seen, smaller than the latest reading's dot.
const LONE_DOT_RADIUS = 1.5;

const area = { left: INSET, top: INSET, width: WIDTH - 2 * INSET, height: HEIGHT - 2 * INSET };

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
export function Sparkline({ points, label, decorative = false, tone = "neutral" }: SparklineProps) {
  const { colors } = useTheme();

  const placed = plotPoints(points, area, valueDomain(points));
  const latestWeek = latestIndex(points);
  const latest = placed.find((point) => point?.index === latestWeek);
  const accessibility = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ accessible: true, role: "img", "aria-label": label } as const);

  return (
    <View {...accessibility}>
      <StyledCanvas className="h-5 w-16">
        {lineRuns(placed).map((run) => (
          <Path
            color={colors[toneColours[tone].line]}
            key={run[0]?.index}
            path={runPath(run)}
            strokeCap="round"
            strokeJoin="round"
            strokeWidth={LINE_WIDTH}
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
              r={LONE_DOT_RADIUS}
            />
          ))}
        {latest !== undefined && latest !== null && (
          <Circle
            color={colors[toneColours[tone].dot]}
            cx={latest.x}
            cy={latest.y}
            r={DOT_RADIUS}
          />
        )}
      </StyledCanvas>
    </View>
  );
}
