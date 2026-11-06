import type { WeightDisplayUnit } from "@keylow/core/weight";

/**
 * The height in centimetres and the weight in kilograms, whatever the unit they are typed in, with the
 * unit the fields show. A height or a weight that cannot be used is `undefined`.
 */
export type BodyAnswers = Readonly<{
  heightCm: number | undefined;
  weightKg: number | undefined;
  weightUnit: WeightDisplayUnit;
}>;

export type BodyStepProps = {
  /** The height to start the fields from, in centimetres, or `undefined` for empty fields. */
  heightCm: number | undefined;
  /** The weight to start the field from, in kilograms, or `undefined` for an empty field. */
  weightKg: number | undefined;
  /** The unit the fields show: kilograms with centimetres, or pounds with feet and inches. */
  weightUnit: WeightDisplayUnit;
  /** The `YYYY-MM-DD` of the weigh-in the weight came from, while the weight is still that number. */
  weighInDate: string | undefined;
  /** Today as `YYYY-MM-DD` in the device's time zone, which the weigh-in's date is told against. */
  today: string;
  /** Called with whatever the fields now hold, and when the unit is switched. */
  onChange: (body: BodyAnswers) => void;
};
