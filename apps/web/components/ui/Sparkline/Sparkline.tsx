import {
  latestIndex,
  lineRuns,
  lonePoints,
  plotPoints,
  runPath,
  valueDomain,
} from "@keylow/core/chart";

import type { SparklineProps, SparklineSize, SparklineTone } from "./types";

type SizeSpec = {
  width: number;
  height: number;
  // Room all round for the line's width and the dot, so neither is cut off at the edge of the drawing.
  inset: number;
  /** Written out in full so Tailwind sees it. */
  lineClassName: string;
  dotRadius: number;
  // A reading with no line to its neighbours, which is still seen, smaller than the latest reading's dot.
  loneDotRadius: number;
  // The ring in the surface colour around the latest dot, written out in full, or none.
  ringClassName: string;
};

const sizes: Record<SparklineSize, SizeSpec> = {
  default: {
    width: 64,
    height: 20,
    inset: 3,
    lineClassName: "stroke-[1.5]",
    dotRadius: 2,
    loneDotRadius: 1.5,
    ringClassName: "",
  },
  wide: {
    width: 128,
    height: 40,
    inset: 4,
    lineClassName: "stroke-2",
    dotRadius: 3.5,
    loneDotRadius: 2,
    ringClassName: "stroke-surface stroke-2",
  },
};

// Written out in full so Tailwind sees each class.
const toneClassNames: Record<SparklineTone, { line: string; loneDot: string; latestDot: string }> =
  {
    neutral: {
      line: "stroke-chart-trend",
      loneDot: "fill-chart-trend",
      latestDot: "fill-chart-marker",
    },
    positive: {
      line: "stroke-success-ink",
      loneDot: "fill-success-ink",
      latestDot: "fill-success-ink",
    },
    negative: { line: "stroke-danger", loneDot: "fill-danger", latestDot: "fill-danger" },
  };

/**
 * A small line of a trend for a row, with a dot on the latest reading, drawn in SVG at a fixed size. A skipped
 * week breaks the line and has no point, and a reading with a skipped week either side is a smaller dot alone.
 * It is an image named by the label, or decoration a screen reader skips when the row's own text says the same.
 */
export function Sparkline({
  points,
  label,
  decorative = false,
  tone = "neutral",
  size = "default",
}: SparklineProps) {
  const spec = sizes[size];
  const colours = toneClassNames[tone];
  const area = {
    left: spec.inset,
    top: spec.inset,
    width: spec.width - 2 * spec.inset,
    height: spec.height - 2 * spec.inset,
  };

  const placed = plotPoints(points, area, valueDomain(points));
  const latestWeek = latestIndex(points);
  const latest = placed.find((point) => point?.index === latestWeek);

  return (
    <svg
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      className="block shrink-0 overflow-visible"
      height={spec.height}
      role={decorative ? undefined : "img"}
      viewBox={`0 0 ${spec.width} ${spec.height}`}
      width={spec.width}
    >
      {lineRuns(placed).map((run) => (
        <path
          className={`fill-none ${colours.line} ${spec.lineClassName}`}
          d={runPath(run)}
          key={run[0]?.index}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {lonePoints(placed)
        .filter((point) => point.index !== latestWeek)
        .map((point) => (
          <circle
            className={colours.loneDot}
            cx={point.x}
            cy={point.y}
            key={point.index}
            r={spec.loneDotRadius}
          />
        ))}
      {latest === undefined || latest === null ? null : (
        <circle
          className={`${colours.latestDot} ${spec.ringClassName}`}
          cx={latest.x}
          cy={latest.y}
          r={spec.dotRadius}
        />
      )}
    </svg>
  );
}
