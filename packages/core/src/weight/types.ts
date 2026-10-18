import type { WeightUnit } from "../format";
import type { WEIGHT_RANGES } from "./bounds";

/** The units a weight can be shown in. Entry is always in kilograms, so pounds are display only. */
export type WeightDisplayUnit = Extract<WeightUnit, "kg" | "lb">;

/** A chart range in days: 7, 30, 90 or 365. */
export type WeightRange = (typeof WEIGHT_RANGES)[number];

/** The columns of `weigh_ins` that the client writes when it adds a row. */
export type WeighInInsert = Readonly<{
  weight_kg: number;
  /** An ISO 8601 instant in UTC. */
  measured_at: string;
  /** The calendar date of `measured_at` in `tz`, written `YYYY-MM-DD`. */
  local_date: string;
  /** The IANA zone of the profile when the row was written. */
  tz: string;
  source: "manual" | "health_connect";
  /** The Health sample id for an import, null for a manual entry. */
  external_id: string | null;
  note: string | null;
}>;

export type ManualWeighInInsert = WeighInInsert & Readonly<{ source: "manual"; external_id: null }>;

export type HealthWeighInInsert = WeighInInsert &
  Readonly<{ source: "health_connect"; external_id: string; note: null }>;

/** The units `react-native-health-connect` returns for a weight. */
export type HealthMassUnit =
  "kilograms" | "grams" | "milligrams" | "micrograms" | "ounces" | "pounds";

/** The three things an import keeps of a Health weight record. Everything else on it is ignored. */
export type HealthWeightSample = Readonly<{
  /** The platform's own id for the record. It is health data and never reaches a log. */
  sampleId: string;
  /** An ISO 8601 instant that carries an offset or `Z`. */
  measuredAt: string;
  value: number;
  unit: HealthMassUnit;
}>;
