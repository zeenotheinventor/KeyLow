import {
  BODY_FAT_MAX_PCT,
  BODY_FAT_MIN_PCT,
  LEAN_MASS_MAX_KG,
  LEAN_MASS_MIN_KG,
} from "@keylow/core/weight";
import { z } from "zod";

import type { BodyMeasurementKind } from "@keylow/core/weight";

const BOUNDS: Record<BodyMeasurementKind, { min: number; max: number }> = {
  body_fat_pct: { min: BODY_FAT_MIN_PCT, max: BODY_FAT_MAX_PCT },
  lean_mass_kg: { min: LEAN_MASS_MIN_KG, max: LEAN_MASS_MAX_KG },
};

/**
 * A live `body_measurements` row as the list reads it. `user_id`, `deleted_at` and `created_at` are not
 * selected, and neither is `external_id`: it is a Health sample id, which the screens have no use for.
 * The value is checked against the bounds of its own kind. The issue it raises names the field only,
 * so a failure never quotes the value.
 */
export const bodyMeasurementSchema = z
  .object({
    id: z.guid(),
    kind: z.enum(["body_fat_pct", "lean_mass_kg"]),
    measured_at: z.iso.datetime({ offset: true }),
    local_date: z.iso.date(),
    tz: z.string(),
    value: z.number(),
    source: z.enum(["manual", "healthkit", "health_connect", "import"]),
  })
  .superRefine((row, context) => {
    const { min, max } = BOUNDS[row.kind];
    if (row.value < min || row.value > max) {
      context.addIssue({ code: "custom", path: ["value"], message: "Out of bounds" });
    }
  });

export type BodyMeasurement = z.infer<typeof bodyMeasurementSchema>;
