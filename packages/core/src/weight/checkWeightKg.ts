import { WEIGH_IN_MAX_KG, WEIGH_IN_MIN_KG } from "./bounds";

export type WeightKgCheck =
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: "not-a-number" | "too-low" | "too-high" }>;

/** Whether a weight in kilograms is a number inside the weigh-in bounds, which are inclusive. The infinities are beyond them. A reason is a code and holds no value. */
export function checkWeightKg(weightKg: number): WeightKgCheck {
  if (Number.isNaN(weightKg)) {
    return { ok: false, reason: "not-a-number" };
  }
  if (weightKg < WEIGH_IN_MIN_KG) {
    return { ok: false, reason: "too-low" };
  }
  if (weightKg > WEIGH_IN_MAX_KG) {
    return { ok: false, reason: "too-high" };
  }
  return { ok: true };
}
