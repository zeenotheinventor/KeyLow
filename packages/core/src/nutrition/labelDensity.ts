import { ML_PER_FLUID_OUNCE, ML_PER_TBSP, ML_PER_TSP } from "./units";

import type { FoodPortion } from "../schemas/food";

/*
 * A density worked out from a food's own serving, such as a label that says "1 tbsp (15 g)".
 *
 * The figure is the manufacturer's, so it is used where no table figure exists. It is only as good as the
 * label: a label is read strictly, and anything ambiguous gives no density rather than a guess.
 */

/** The densities a label may give. A figure outside it is a mistyped label, not a food. */
export const LABEL_DENSITY_RANGE = { min: 0.05, max: 2.5 } as const;

/** What a serving label says: a volume, and the weight it came with if the label gave one. */
export type ServingLabelMeasure = { volumeMl: number; grams: number | null };

// The app's metric spoons (5 and 15 ml), a US fluid ounce (29.5735 ml) and the metric cup of 250 ml. A US cup
// is 240 ml, so a label that gives a cup in millilitres is read by those, see `parseServingLabel`. This cup is
// not the picker's "1 cup" chip (`ML_PER_CUP` in `units`): a label that states a cup with no millilitres is
// still read as the metric cup, so the densities already frozen into entries do not change.
const ML_PER_METRIC_CUP = 250;

const VOLUME_UNITS: readonly { pattern: string; ml: number; isMetric: boolean }[] = [
  { pattern: "tsp|tsps|teaspoons?", ml: ML_PER_TSP, isMetric: false },
  { pattern: "tbsp|tbsps|tbs|tablespoons?", ml: ML_PER_TBSP, isMetric: false },
  { pattern: "fl\\.?\\s*oz", ml: ML_PER_FLUID_OUNCE, isMetric: false },
  { pattern: "cups?", ml: ML_PER_METRIC_CUP, isMetric: false },
  { pattern: "ml|millilit(?:re|er)s?", ml: 1, isMetric: true },
  { pattern: "cl|centilit(?:re|er)s?", ml: 10, isMetric: true },
  { pattern: "l|lit(?:re|er)s?", ml: 1000, isMetric: true },
];

const UNICODE_FRACTIONS: Readonly<Record<string, string>> = { "½": "1/2", "¼": "1/4", "¾": "3/4" };

// "1.5", "1/2", "1 1/2", "½", "1½" and "1 ½".
const NUMBER = String.raw`(\d+\s*[½¼¾]|[½¼¾]|\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?|\.\d+)`;
const UNIT_END = String.raw`\.?(?![a-z])`;

const measureRegex = (unitPattern: string) =>
  new RegExp(String.raw`(?<![\d./])${NUMBER}\s*(?:${unitPattern})${UNIT_END}`, "gi");

const GRAMS = measureRegex("g|grams?");

// Words that change how much a spoon holds, so the label's weight is not for a level spoon.
const UNLEVEL_SPOON = /\b(?:heaped|heaping|rounded|generous|scant|piled)\b/i;

// A measure written within 10 percent of another is the same measure: a US cup is 240 ml and the metric cup 250.
const SAME_MEASURE_TOLERANCE = 0.1;
// A label and a portion row that give the same weight agree to within a rounding error.
const SAME_WEIGHT_TOLERANCE = 0.01;

const readFraction = (text: string): number => {
  const [top, bottom] = text.split("/");
  return bottom === undefined ? Number(top) : Number(top) / Number(bottom);
};

const readNumber = (text: string): number =>
  text
    .replace(/[½¼¾]/g, (fraction) => ` ${UNICODE_FRACTIONS[fraction] ?? ""}`)
    .trim()
    .split(/\s+/)
    .reduce((sum, part) => sum + readFraction(part), 0);

const isWithin = (first: number, second: number, tolerance: number): boolean =>
  Math.abs(first - second) <= tolerance * Math.max(first, second);

/**
 * Reads a serving label such as "1 tbsp (15 g)", "2 tsp / 4 g" or "1 cup (240 ml) 250 g" into a volume in
 * millilitres and the grams it came with, or null when the label has no volume or is ambiguous. A label
 * with a volume and no grams ("1 tbsp") gives `grams: null`.
 *
 * A number sits straight before each unit; case and a full stop after the unit do not matter. The volume
 * units are tsp, tbsp, ml, cl, l, fl oz and cup, in their long forms too; the weight unit is g. When the
 * label gives its volume twice ("1 cup (240 ml)") the metric figure is used, and the two must agree.
 * It is ambiguous, and so null, when:
 *   - a number is left over, which covers a range ("1-2 tbsp"), a count ("2 pieces") and a unit not read
 *     (oz, dl);
 *   - the volumes disagree, or the weights do ("1 tbsp (15 g or 20 g)");
 *   - the spoon is heaped, rounded or scant;
 *   - the volume is 0.
 */
export const parseServingLabel = (label: string): ServingLabelMeasure | null => {
  const read = readServingLabel(label);
  return read === null ? null : { volumeMl: read.volumeMl, grams: read.grams };
};

// `parseServingLabel`, and whether the label wrote its volume in metric units (`statedMl`).
const readServingLabel = (
  label: string,
): (ServingLabelMeasure & { statedMl: number | null }) | null => {
  if (UNLEVEL_SPOON.test(label)) {
    return null;
  }
  let rest = label;
  const volumes: { ml: number; isMetric: boolean }[] = [];
  for (const unit of VOLUME_UNITS) {
    rest = rest.replace(measureRegex(unit.pattern), (_match, count: string) => {
      volumes.push({ ml: readNumber(count) * unit.ml, isMetric: unit.isMetric });
      return " ";
    });
  }
  const weights: number[] = [];
  rest = rest.replace(GRAMS, (_match, count: string) => {
    weights.push(readNumber(count));
    return " ";
  });
  const [first] = volumes;
  const [firstWeight] = weights;
  if (/[\d½¼¾]/.test(rest) || first === undefined) {
    return null;
  }
  const volume = volumes.find((candidate) => candidate.isMetric) ?? first;
  const isConsistent =
    volumes.every((candidate) => isWithin(candidate.ml, volume.ml, SAME_MEASURE_TOLERANCE)) &&
    weights.every((weight) => weight === firstWeight);
  if (!isConsistent || !(volume.ml > 0) || (firstWeight !== undefined && !(firstWeight > 0))) {
    return null;
  }
  return {
    volumeMl: volume.ml,
    grams: firstWeight ?? null,
    statedMl: volume.isMetric ? volume.ml : null,
  };
};

/** The part of a food portion a density is read from: its label and its grams. */
export type PortionForDensity = Pick<FoodPortion, "label" | "grams" | "ml">;

// A portion's volume and weight: the label's pair, or the label's volume with the row's grams. A label
// and a row that both give a weight must agree. A row's grams that equal the label's own figure in
// millilitres are that figure misfiled, not a weight: for a per 100 g product `servingPortion` stores
// serving_quantity as grams, whatever unit the label wrote it in, so "1 tbsp (15 ml)" gives a row of 15 g.
const measureOfPortion = (
  portion: PortionForDensity,
): { volumeMl: number; grams: number } | null => {
  const measure = readServingLabel(portion.label);
  if (measure === null) {
    return null;
  }
  const isMillilitresMisfiledAsGrams =
    measure.grams === null &&
    measure.statedMl !== null &&
    portion.grams !== null &&
    isWithin(measure.statedMl, portion.grams, SAME_WEIGHT_TOLERANCE);
  if (isMillilitresMisfiledAsGrams) {
    return null;
  }
  const grams = measure.grams ?? portion.grams;
  const rowDisagrees =
    measure.grams !== null &&
    portion.grams !== null &&
    !isWithin(measure.grams, portion.grams, SAME_WEIGHT_TOLERANCE);
  return grams === null || rowDisagrees ? null : { volumeMl: measure.volumeMl, grams };
};

/**
 * The density in grams per millilitre that a food's own portions give, or null. A portion gives one when
 * its label reads as a volume (see `parseServingLabel`) and a weight is known, from the label or from the
 * portion's own grams; a figure outside `LABEL_DENSITY_RANGE` is ignored. With several portions the one
 * with the largest volume wins, because a label rounds its grams to a whole number or a tenth and that is
 * the least error on the largest portion; so the order the portions come in never changes the answer.
 */
export const densityFromPortions = (portions: readonly PortionForDensity[]): number | null => {
  const candidates = portions.flatMap((portion) => {
    const measure = measureOfPortion(portion);
    return measure === null ? [] : [{ ...measure, gPerMl: measure.grams / measure.volumeMl }];
  });
  const plausible = candidates
    .filter(({ gPerMl }) => gPerMl >= LABEL_DENSITY_RANGE.min && gPerMl <= LABEL_DENSITY_RANGE.max)
    .sort((first, second) => second.volumeMl - first.volumeMl || first.gPerMl - second.gPerMl);
  return plausible[0]?.gPerMl ?? null;
};
