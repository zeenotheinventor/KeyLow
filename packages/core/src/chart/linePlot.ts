import { MONTH_NAMES_SHORT } from "../copy/diaryDay";

/** The rectangle a series is drawn in, in the points of the drawing. */
export type PlotArea = { left: number; top: number; width: number; height: number };

export type ValueDomain = { min: number; max: number };

/** A reading placed on the drawing. `index` is the week it came from. */
export type PlotPoint = { index: number; x: number; y: number };

const readings = (values: readonly (number | null)[]): number[] =>
  values.filter((value): value is number => value !== null);

/** The likely range of a week: the shaded band of a chart runs from `low` to `high` through it. */
export type BandEnds = { low: number; high: number };

/** The band of each week, as long as the values: a week without a value or without a band has none. */
export function weekBands(
  values: readonly (number | null)[],
  band: readonly (BandEnds | null | undefined)[] = [],
): (BandEnds | null)[] {
  return values.map((value, index) => (value === null ? null : (band[index] ?? null)));
}

/**
 * The lowest to the highest reading, and the ends of the band when there is one, so the band is never cut
 * off. A series that never moves is opened by one either side, so its line sits in the middle and the axis
 * still has three different ticks. Without a reading there is no domain.
 */
export function valueDomain(
  values: readonly (number | null)[],
  band?: readonly (BandEnds | null | undefined)[],
): ValueDomain | undefined {
  const present = [
    ...readings(values),
    ...weekBands(values, band).flatMap((ends) => (ends === null ? [] : [ends.low, ends.high])),
  ];
  if (present.length === 0) {
    return undefined;
  }
  const min = Math.min(...present);
  const max = Math.max(...present);
  return min === max ? { min: min - 1, max: max + 1 } : { min, max };
}

/** The last week that has a reading, which is the week a trend chart emphasises. */
export function latestIndex(values: readonly (number | null)[]): number | undefined {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) {
      return index;
    }
  }
  return undefined;
}

/**
 * Each reading placed on the area: the weeks spread evenly across the width (a lone week in the middle),
 * and the highest value at the top. A gap stays `null` at its own place, so the weeks keep their spacing.
 */
export function plotPoints(
  values: readonly (number | null)[],
  area: PlotArea,
  domain: ValueDomain | undefined,
): (PlotPoint | null)[] {
  return values.map((value, index) => {
    if (value === null || domain === undefined) {
      return null;
    }
    const across = values.length === 1 ? 0.5 : index / (values.length - 1);
    const up = (value - domain.min) / (domain.max - domain.min);
    return { index, x: area.left + across * area.width, y: area.top + (1 - up) * area.height };
  });
}

/**
 * The stretches of weeks with a reading in each, which a line is drawn through. A gap ends a stretch, and a
 * reading with a gap on both sides is a stretch of one, which has no line to draw, so it is left out.
 */
export function lineRuns(points: readonly (PlotPoint | null)[]): PlotPoint[][] {
  const runs: PlotPoint[][] = [];
  let current: PlotPoint[] = [];
  for (const point of [...points, null]) {
    if (point === null) {
      if (current.length >= 2) {
        runs.push(current);
      }
      current = [];
    } else {
      current.push(point);
    }
  }
  return runs;
}

/**
 * The readings that stand alone, with a skipped week or an edge of the series on both sides. They have no
 * line to draw, so a chart that wants every reading seen draws them as dots.
 */
export function lonePoints(points: readonly (PlotPoint | null)[]): PlotPoint[] {
  return points.flatMap((point, position) =>
    point !== null && !points[position - 1] && !points[position + 1] ? [point] : [],
  );
}

const twoDecimals = (value: number): number => Math.round(value * 100) / 100;

/** An SVG path through a stretch of points: straight segments, so the line shows the readings and nothing between them. */
export function runPath(run: readonly PlotPoint[]): string {
  return run
    .map(({ x, y }, position) => `${position === 0 ? "M" : "L"}${twoDecimals(x)} ${twoDecimals(y)}`)
    .join(" ");
}

/** A place on the drawing. A week with no value has no `y`. */
export type BandVertex = { x: number; y: number | null | undefined };

/** The width of the bar a week alone is given for its band, since a lone point has no line to run a band along. */
export const LONE_BAND_WIDTH = 12;

/**
 * An SVG path for the band: for each stretch of weeks that have one, along the high ends, back along the low
 * ends and closed, as straight segments like the line. A week without a band ends a stretch, and a week
 * alone is a bar `LONE_BAND_WIDTH` wide, centred on its place. `high` and `low` are the same weeks in the same
 * order.
 */
export function bandPath(high: readonly BandVertex[], low: readonly BandVertex[]): string {
  const shapes: string[] = [];
  let run: { x: number; high: number; low: number }[] = [];

  const endRun = () => {
    const [only, ...rest] = run;
    if (only !== undefined && rest.length === 0) {
      const left = twoDecimals(only.x - LONE_BAND_WIDTH / 2);
      const right = twoDecimals(only.x + LONE_BAND_WIDTH / 2);
      shapes.push(
        `M${left} ${twoDecimals(only.high)} H${right} V${twoDecimals(only.low)} H${left} Z`,
      );
    } else if (only !== undefined) {
      const along = run.map(
        ({ x, high: y }, position) =>
          `${position === 0 ? "M" : "L"}${twoDecimals(x)} ${twoDecimals(y)}`,
      );
      const back = [...run]
        .reverse()
        .map(({ x, low: y }) => `L${twoDecimals(x)} ${twoDecimals(y)}`);
      shapes.push([...along, ...back, "Z"].join(" "));
    }
    run = [];
  };

  high.forEach((top, index) => {
    const bottom = low[index];
    if (typeof top.y === "number" && typeof bottom?.y === "number") {
      run.push({ x: top.x, high: top.y, low: bottom.y });
    } else {
      endRun();
    }
  });
  endRun();
  return shapes.join(" ");
}

/** The values the axis labels, top to bottom: the highest, the middle and the lowest. */
export function axisTicks({ min, max }: ValueDomain): [number, number, number] {
  return [max, (min + max) / 2, min];
}

/** A tick as the axis writes it: one decimal at most, and a whole number without the `.0`. */
export function formatTick(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * The weeks that get a label under the chart, so labels never run into each other: every week of a short
 * series, and for a longer one every few weeks so that at most `maxLabels` are written. They count back
 * from the latest week, which is always labelled.
 */
export function labelledIndexes(count: number, maxLabels: number): Set<number> {
  const step = Math.max(1, Math.ceil(count / maxLabels));
  const indexes = new Set<number>();
  for (let index = count - 1; index >= 0; index -= step) {
    indexes.add(index);
  }
  return indexes;
}

/** A week start such as "2026-10-12" as the chart writes it under the line: "12 Oct". */
export function weekLabel(weekStart: string): string {
  const [, month = "", day = ""] = weekStart.split("-");
  return `${Number(day)} ${MONTH_NAMES_SHORT[Number(month) - 1] ?? ""}`;
}

/**
 * The room a weekly chart leaves inside its drawing, in pixels: the weeks sit between `left` and
 * `right`, and the value axis is written in the column on the right. It is the weight chart's inset, so
 * the two web charts read alike.
 */
export const WEEK_CHART_INSET = { left: 12, right: 44, top: 8, bottom: 12 } as const;

/** The column on the right that holds the axis values, where the grid lines stop. */
export const VALUE_COLUMN_WIDTH = 40;

/** From this measured width on a weekly chart is drawn tall, with more week labels. */
export const WIDE_CHART_MIN_WIDTH = 480;

/**
 * How tall a weekly chart is and how many week labels it can write, decided by the width its container
 * gives the drawing and by nothing else, so the chart holds in a two column page, a card or a phone.
 */
export function weekChartLayout(width: number): { height: number; maxWeekLabels: number } {
  return width >= WIDE_CHART_MIN_WIDTH
    ? { height: 220, maxWeekLabels: 7 }
    : { height: 160, maxWeekLabels: 4 };
}

/** The rectangle the weeks are drawn in, once the room for the axis is taken off a drawing of this size. */
export function weekPlotArea(width: number, height: number): PlotArea {
  return {
    left: WEEK_CHART_INSET.left,
    top: WEEK_CHART_INSET.top,
    width: width - WEEK_CHART_INSET.left - WEEK_CHART_INSET.right,
    height: height - WEEK_CHART_INSET.top - WEEK_CHART_INSET.bottom,
  };
}

/** Where the three grid lines are, from the top of the plot to its bottom through the middle. */
export function gridLineYs({ top, height }: PlotArea): [number, number, number] {
  return [top, top + height / 2, top + height];
}

/** Each week's column on the area, equal in width, which is also the week's press target. */
export function weekColumns(count: number, area: PlotArea): { left: number; width: number }[] {
  const width = area.width / count;
  return Array.from({ length: count }, (_, index) => ({ left: area.left + index * width, width }));
}

/**
 * Each reading placed on the area with every week an equal column and its point in the middle of it, as the
 * phone's chart does with its domain of -0.5 to n - 0.5. The highest value of the domain is at the top. A
 * gap stays `null` at its own place.
 */
export function plotWeekColumns(
  values: readonly (number | null)[],
  area: PlotArea,
  domain: ValueDomain | undefined,
): (PlotPoint | null)[] {
  const columns = weekColumns(values.length, area);
  return values.map((value, index) => {
    const column = columns[index];
    if (value === null || domain === undefined || column === undefined) {
      return null;
    }
    const up = (value - domain.min) / (domain.max - domain.min);
    return { index, x: column.left + column.width / 2, y: area.top + (1 - up) * area.height };
  });
}

/**
 * The path of the band on a weekly chart: the ends of each week's band placed in the week's column, then
 * `bandPath` for the stretches that have one. Empty without a domain or without a band.
 */
export function weekBandPath(
  values: readonly (number | null)[],
  band: readonly (BandEnds | null | undefined)[],
  area: PlotArea,
  domain: ValueDomain | undefined,
): string {
  const bands = weekBands(values, band);
  const place = (pick: (ends: BandEnds) => number): BandVertex[] => {
    const columns = weekColumns(values.length, area);
    const placed = plotWeekColumns(
      bands.map((ends) => (ends === null ? null : pick(ends))),
      area,
      domain,
    );
    return placed.map((point, index) => {
      const column = columns[index];
      return { x: (column?.left ?? 0) + (column?.width ?? 0) / 2, y: point?.y };
    });
  };
  return bandPath(
    place((ends) => ends.high),
    place((ends) => ends.low),
  );
}
