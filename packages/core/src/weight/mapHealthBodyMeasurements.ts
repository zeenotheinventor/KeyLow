import { toLocalDate } from "../dates";
import {
  BODY_FAT_MAX_PCT,
  BODY_FAT_MIN_PCT,
  LEAN_MASS_MAX_KG,
  LEAN_MASS_MIN_KG,
} from "./bodyBounds";
import { isUsableSampleId, toKilograms } from "./mapHealthSample";
import { parseInstant } from "./parseInstant";
import { roundToGram } from "./roundToGram";

import type {
  BodyMeasurementInsert,
  BodyMeasurementKind,
  HealthBodyFatSample,
  HealthLeanMassSample,
} from "./bodyTypes";
import type { HealthImportOptions } from "./mapHealthSample";

type MappedBodyMeasurements = Readonly<{
  rows: BodyMeasurementInsert[];
  /** How many samples could not be used. A count only, so the runner can log it. */
  skipped: number;
}>;

type KindRules<Sample> = Readonly<{
  kind: BodyMeasurementKind;
  min: number;
  max: number;
  /** The value in the unit of the column, before rounding. NaN when the sample has no usable value. */
  toColumnValue: (sample: Sample) => number;
}>;

type SampleCore = Readonly<{ sampleId: string; measuredAt: string }>;

/**
 * Keeps only the value, the time and the id of each sample, and nothing else the record carries. A
 * sample is skipped, and counted, for an id that is empty or over 200 characters, a time with no
 * offset or that does not exist, or a value that is not a number or, after rounding to 3 decimals
 * (half away from zero, as the column does), is outside the kind's bounds.
 */
function mapSamples<Sample extends SampleCore>(
  samples: readonly Sample[],
  { timeZone }: HealthImportOptions,
  { kind, min, max, toColumnValue }: KindRules<Sample>,
): MappedBodyMeasurements {
  const rows = samples.flatMap((sample) => {
    const { sampleId, measuredAt } = sample;
    const instant = isUsableSampleId(sampleId) ? parseInstant(measuredAt) : null;
    const value = roundToGram(toColumnValue(sample));
    if (instant === null || !(value >= min && value <= max)) {
      return [];
    }

    return [
      {
        kind,
        value,
        measured_at: instant.toISOString(),
        local_date: toLocalDate(instant, timeZone),
        tz: timeZone,
        source: "health_connect",
        external_id: sampleId,
      } satisfies BodyMeasurementInsert,
    ];
  });

  return { rows, skipped: samples.length - rows.length };
}

/** Maps a batch of Health body fat samples. A sample that cannot be used is counted and never blocks the others. */
export function mapHealthBodyFatSamples(
  samples: readonly HealthBodyFatSample[],
  options: HealthImportOptions,
): MappedBodyMeasurements {
  return mapSamples(samples, options, {
    kind: "body_fat_pct",
    min: BODY_FAT_MIN_PCT,
    max: BODY_FAT_MAX_PCT,
    toColumnValue: ({ value }) => value,
  });
}

/** Maps a batch of Health lean mass samples, converting each to kilograms as a weight sample is. */
export function mapHealthLeanMassSamples(
  samples: readonly HealthLeanMassSample[],
  options: HealthImportOptions,
): MappedBodyMeasurements {
  return mapSamples(samples, options, {
    kind: "lean_mass_kg",
    min: LEAN_MASS_MIN_KG,
    max: LEAN_MASS_MAX_KG,
    toColumnValue: ({ value, unit }) => toKilograms(value, unit),
  });
}
