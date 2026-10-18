import { toLocalDate } from "../dates";
import { HEALTH_SAMPLE_ID_MAX_CHARS, WEIGH_IN_MAX_KG, WEIGH_IN_MIN_KG } from "./bounds";
import { parseInstant } from "./parseInstant";
import { roundToGram } from "./roundToGram";
import { KILOGRAMS_PER_POUND } from "./units";
import { characterCount } from "../recipes/characterCount";

import type { HealthMassUnit, HealthWeighInInsert, HealthWeightSample } from "./types";

const KILOGRAMS_PER_OUNCE = 0.028349523125;
const GRAMS_PER_KILOGRAM = 1000;
const MILLIGRAMS_PER_KILOGRAM = 1_000_000;
const MICROGRAMS_PER_KILOGRAM = 1_000_000_000;

/**
 * The metric units divide, because a division is correctly rounded and so keeps 19999.5 g at exactly
 * 19.9995 kg, where a multiplication by 0.001 might not. A unit outside the list, which a native
 * module could return, gives NaN and so a skipped sample.
 */
function toKilograms(value: number, unit: HealthMassUnit): number {
  switch (unit) {
    case "kilograms":
      return value;
    case "grams":
      return value / GRAMS_PER_KILOGRAM;
    case "milligrams":
      return value / MILLIGRAMS_PER_KILOGRAM;
    case "micrograms":
      return value / MICROGRAMS_PER_KILOGRAM;
    case "ounces":
      return value * KILOGRAMS_PER_OUNCE;
    case "pounds":
      return value * KILOGRAMS_PER_POUND;
    default:
      return Number.NaN;
  }
}

/** 1 to 200 characters, as the `external_id` check wants. A native module could give anything, so it is not trusted to be a string. */
function isUsableSampleId(sampleId: unknown): sampleId is string {
  if (typeof sampleId !== "string") {
    return false;
  }
  const length = characterCount(sampleId);
  return length >= 1 && length <= HEALTH_SAMPLE_ID_MAX_CHARS;
}

type HealthImportOptions = Readonly<{
  /** The IANA zone of the profile. The sample's own offset is not a zone and is not used for the day. */
  timeZone: string;
}>;

/**
 * The row to insert for one Health weight sample, or null when the sample cannot be used: a sample id
 * that is empty or over 200 characters (it would break the `external_id` check and fail the whole bulk
 * import), a time with no offset or that does not exist, or a weight that is not a number or, after the
 * conversion to kilograms and the rounding to 3 decimals (half away from zero), is outside 20 to 400 kg.
 *
 * It keeps the value, the timestamp and the sample id, and nothing else the record carries. The same
 * sample always gives the same row, so the import key is stable. It never throws for a bad sample
 * and never puts a weight or a sample id anywhere but in the row.
 */
export function mapHealthSample(
  sample: HealthWeightSample,
  { timeZone }: HealthImportOptions,
): HealthWeighInInsert | null {
  const { sampleId, measuredAt, value, unit } = sample;

  if (!isUsableSampleId(sampleId)) {
    return null;
  }

  const instant = parseInstant(measuredAt);
  if (instant === null) {
    return null;
  }

  const weightKg = roundToGram(toKilograms(value, unit));
  if (!(weightKg >= WEIGH_IN_MIN_KG && weightKg <= WEIGH_IN_MAX_KG)) {
    return null;
  }

  return {
    weight_kg: weightKg,
    measured_at: instant.toISOString(),
    local_date: toLocalDate(instant, timeZone),
    tz: timeZone,
    source: "health_connect",
    external_id: sampleId,
    note: null,
  };
}

type MappedHealthSamples = Readonly<{
  rows: HealthWeighInInsert[];
  /** How many samples could not be used. A count only, so the runner can log it. */
  skipped: number;
}>;

/** Maps a batch. A sample that cannot be used is counted and dropped, and never blocks the others. */
export function mapHealthSamples(
  samples: readonly HealthWeightSample[],
  options: HealthImportOptions,
): MappedHealthSamples {
  const rows = samples.flatMap((sample) => {
    const row = mapHealthSample(sample, options);
    return row === null ? [] : [row];
  });

  return { rows, skipped: samples.length - rows.length };
}
