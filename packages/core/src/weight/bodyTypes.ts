import type { HealthMassUnit } from "./types";

/** The two body composition measurements Ki-Lo keeps. */
export type BodyMeasurementKind = "body_fat_pct" | "lean_mass_kg";

/** The three things an import keeps of a Health body fat record. Everything else on it is ignored. */
export type HealthBodyFatSample = Readonly<{
  /** The platform's own id for the record. It is health data and never reaches a log. */
  sampleId: string;
  /** An ISO 8601 instant that carries an offset or `Z`. */
  measuredAt: string;
  /** Percentage points, 0 to 100, as Health Connect gives them. */
  value: number;
}>;

/** The three things an import keeps of a Health lean mass record. Everything else on it is ignored. */
export type HealthLeanMassSample = Readonly<{
  /** The platform's own id for the record. It is health data and never reaches a log. */
  sampleId: string;
  /** An ISO 8601 instant that carries an offset or `Z`. */
  measuredAt: string;
  value: number;
  unit: HealthMassUnit;
}>;

/** The columns of `body_measurements` that the client writes when it imports a row. */
export type BodyMeasurementInsert = Readonly<{
  kind: BodyMeasurementKind;
  /** Per cent for body fat and kilograms for lean mass, rounded to 3 decimals. */
  value: number;
  /** An ISO 8601 instant in UTC. */
  measured_at: string;
  /** The calendar date of `measured_at` in `tz`, written `YYYY-MM-DD`. */
  local_date: string;
  /** The IANA zone of the profile when the row was written. */
  tz: string;
  source: "health_connect";
  /** The Health sample id. */
  external_id: string;
}>;

/** One live body measurement as the trend reads it. The caller has already dropped soft-deleted ones. */
export type BodyReading = Readonly<{
  /** The day of the reading in the user's time zone, written `YYYY-MM-DD`. */
  localDate: string;
  /** Per cent for body fat and kilograms for lean mass. */
  value: number;
}>;

/** One calendar day of a body composition trend. Values are full float, never rounded. */
export type BodyTrendPoint = Readonly<{
  date: string;
  /** Which run of readings this day belongs to. A gap over 30 days starts the next one, from 0. */
  segment: number;
  trend: number;
  /** The day's median reading, or null when the day had none. */
  raw: number | null;
  /** True when the trend was fed a value filled in between two readings, not measured. */
  interpolated: boolean;
  /** Reading days in the segment up to and including this day. */
  nObs: number;
}>;

/** What the composition chart shows its two lines in: kilograms, or per cent of the weight trend. */
export type BodySplitUnit = "kg" | "pct";

/** One day of the composition chart. Full float, never rounded. */
export type BodySplitPoint = Readonly<{
  /** The day, written `YYYY-MM-DD`. */
  date: string;
  /** The chart breaks the line where this changes. It counts from 0. */
  segment: number;
  /** Kilograms, or per cent of the weight trend. */
  fat: number;
  /** Kilograms, or per cent of the weight trend. */
  lean: number;
}>;

/** The two lines of the composition chart, and what they were worked out from. */
export type BodySplit = Readonly<{
  /** The kind the split was worked out from, or null when neither kind has a trend point. */
  driver: BodyMeasurementKind | null;
  points: BodySplitPoint[];
  /** The driver's trend is still settling. False with no driver. */
  settling: boolean;
}>;
