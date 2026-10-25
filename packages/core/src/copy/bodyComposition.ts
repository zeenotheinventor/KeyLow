import { HEALTH_CONNECT_NAME, WEIGHT_RANGE_LABELS } from "./weight";
import { TREND_SETTLED_OBS } from "../weight/bounds";

import type { BodyMeasurementKind, BodySplitUnit } from "../weight/bodyTypes";
import type { WeightRange } from "../weight/types";

/**
 * The words of the body composition section of the Weight screen, from the canvas "Ki-Lo M5 screens",
 * version 10, boards `weight: chart and weigh-ins` and `body-composition: components`. The settling
 * badge is `WEIGHT_SCREEN.settlingBadge`. Health Connect is the only service Ki-Lo reads from.
 */
export const BODY_COMPOSITION = {
  heading: "Body composition",
  kinds: {
    body_fat_pct: { label: "Body fat", unit: "%", changeUnit: "points" },
    lean_mass_kg: { label: "Lean mass", unit: "kg", changeUnit: "kg" },
  },
  /** Under the cards, shown when a lean mass card is. */
  caption: "Lean mass includes bone and water as well as muscle.",
  /** The name of the section's status region in the `loading` state. */
  loadingLabel: "Loading body fat and lean mass",
  /** The `not-allowed` prompt: neither kind is allowed yet. */
  notAllowed: {
    title: "See body fat and lean mass here",
    text: `If your smart scale records them, Ki-Lo can read them from ${HEALTH_CONNECT_NAME} and show a trend for each.`,
    action: "Add body fat and lean mass",
  },
  /** The `no-readings-yet` prompt: allowed, but nothing has come in. */
  noReadings: {
    title: "No body fat or lean mass readings yet",
    text: `Weigh in on a smart scale that saves body fat and lean mass to ${HEALTH_CONNECT_NAME}. New readings show here the next time you open Ki-Lo.`,
  },
  /** The `partial` prompt, by the kind that cannot be read yet. */
  partial: {
    body_fat_pct: { text: "Ki-Lo can't read body fat yet.", action: "Add body fat" },
    lean_mass_kg: { text: "Ki-Lo can't read lean mass yet.", action: "Add lean mass" },
  },
  error: {
    title: "Couldn't load body fat and lean mass",
    body: "Check your connection and try again.",
    retry: "Try again",
  },
} as const;

const TRUE_MINUS_SIGN = "−";

// The span words are the weight chart's: "the last week", "the last 30 days" and so on.
const CHART_SPAN_WORDS: Readonly<Record<WeightRange, string>> = {
  7: "the last week",
  30: "the last 30 days",
  90: "the last 90 days",
  365: "the last year",
};

// A describer never throws and never prints "NaN". A number that is not finite is written as nothing,
// or as zero for a count, and a change that is not a number is steady. The fallbacks hold no reading
// beyond the one the caller passed in.
const countOrZero = (count: number): number => (Number.isFinite(count) ? count : 0);

const roundToOneDecimal = (value: number): number => Math.round(value * 10) / 10;

/**
 * A reading as the card draws it, in two pieces: 22.44 gives "22.4" and "%", and 63.14 gives "63.1" and
 * "kg". A value that is not a number gives empty text and keeps the unit.
 */
export const describeBodyValue = (
  kind: BodyMeasurementKind,
  value: number,
): Readonly<{ valueText: string; unit: string }> => ({
  valueText: Number.isFinite(value) ? roundToOneDecimal(value).toFixed(1) : "",
  unit: BODY_COMPOSITION.kinds[kind].unit,
});

/**
 * The card's change badge: "−0.6 points over 90 days" for body fat, "−0.2 kg over 90 days" for lean
 * mass, "+0.4 points over 30 days" for a gain, and "0.0 points over 1 week" for a change that rounds to
 * 0.0 either way, so a tiny gain prints no sign. A change that is not a number counts as steady.
 */
export const describeBodyChange = (
  kind: BodyMeasurementKind,
  change: number,
  range: WeightRange,
): string => {
  const rounded = Number.isFinite(change) ? roundToOneDecimal(Math.abs(change)) : 0;
  const sign = rounded === 0 ? "" : change < 0 ? TRUE_MINUS_SIGN : "+";

  return `${sign}${rounded.toFixed(1)} ${BODY_COMPOSITION.kinds[kind].changeUnit} over ${WEIGHT_RANGE_LABELS[range]}`;
};

/**
 * The sparkline's name for a screen reader: "Body fat over the last 90 days, trend 22.4 %". With a trend
 * that is not a number it drops the trend: "Body fat over the last 90 days".
 */
export const describeBodyChartName = (
  kind: BodyMeasurementKind,
  range: WeightRange,
  trend: number,
): string => {
  const name = `${BODY_COMPOSITION.kinds[kind].label} over ${CHART_SPAN_WORDS[range]}`;
  const { valueText, unit } = describeBodyValue(kind, trend);

  return valueText === "" ? name : `${name}, trend ${valueText} ${unit}`;
};

/** The line under a card while its trend settles: "Settles after 7 readings. 3 of 7 so far." */
export const describeBodySettlingLine = (readingCount: number): string =>
  `Settles after ${TREND_SETTLED_OBS} readings. ${countOrZero(readingCount)} of ${TREND_SETTLED_OBS} so far.`;

/** The line on a card whose range holds too few readings: "Not enough readings in the last week to show a change." */
export const describeBodyRangeEmpty = (range: WeightRange): string =>
  `Not enough readings in ${CHART_SPAN_WORDS[range]} to show a change.`;

type BodyCountsInput = Readonly<{ bodyFat: number; leanMass: number }>;

/**
 * The counts line of `connected`: "Also 12 body fat and 12 lean mass readings." One kind alone is "Also
 * 12 body fat readings." or "Also 12 lean mass readings.", and the noun is "reading" when the last number
 * is 1. Null when both counts are zero, because the line shows only when body readings came in. The board
 * draws only the both-kinds case.
 */
export const describeBodyCounts = ({ bodyFat, leanMass }: BodyCountsInput): string | null => {
  const bodyFatCount = countOrZero(bodyFat);
  const leanMassCount = countOrZero(leanMass);
  const parts = [
    bodyFatCount > 0 ? `${bodyFatCount} body fat` : null,
    leanMassCount > 0 ? `${leanMassCount} lean mass` : null,
  ].filter((part) => part !== null);
  if (parts.length === 0) {
    return null;
  }
  const lastCount = leanMassCount > 0 ? leanMassCount : bodyFatCount;

  return `Also ${parts.join(" and ")} ${lastCount === 1 ? "reading" : "readings"}.`;
};

/** The switches above the trend card's chart and the words around the composition view. */
export const BODY_COMPOSITION_CHART = {
  viewGroupLabel: "Chart view",
  views: { weight: "Weight", composition: "Composition" },
  unitGroupLabel: "Show as",
  units: { kg: "kg", pct: "%" },
} as const;

type CompositionLatest = Readonly<{ fat: number; lean: number }>;

/**
 * The composition figure's name for a screen reader: "Body fat and lean mass over the last 90 days, body
 * fat 18.2 kg, lean mass 64.9 kg", and in per cent "..., body fat 22.4 %, lean mass 77.6 %". Without
 * latest values, or when either is not a number, it is only the span: "Body fat and lean mass over the
 * last 90 days".
 */
export const describeCompositionChartName = (
  range: WeightRange,
  unit: BodySplitUnit,
  latest: CompositionLatest | null,
): string => {
  const name = `Body fat and lean mass over ${CHART_SPAN_WORDS[range]}`;
  if (latest === null || !Number.isFinite(latest.fat) || !Number.isFinite(latest.lean)) {
    return name;
  }
  const unitText = BODY_COMPOSITION_CHART.units[unit];
  const fat = roundToOneDecimal(latest.fat).toFixed(1);
  const lean = roundToOneDecimal(latest.lean).toFixed(1);

  return `${name}, body fat ${fat} ${unitText}, lean mass ${lean} ${unitText}`;
};

/** The line under the chart, saying which reading the two lines were worked out from. */
export const describeCompositionSource = (driver: BodyMeasurementKind): string =>
  `Worked out from your ${driver === "body_fat_pct" ? "body fat" : "lean mass"} and trend weight.`;
