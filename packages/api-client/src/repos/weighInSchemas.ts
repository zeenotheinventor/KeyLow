import { WEIGH_IN_MAX_KG, WEIGH_IN_MIN_KG } from "@keylow/core/weight";
import { z } from "zod";

/**
 * A live `weigh_ins` row as the list reads it. `user_id`, `deleted_at` and `created_at` are not
 * selected, and neither is `external_id`: it is a Health sample id, which the screens have no use for.
 * `source` is kept, because an imported row can only be deleted.
 */
export const weighInSchema = z.object({
  id: z.guid(),
  measured_at: z.iso.datetime({ offset: true }),
  local_date: z.iso.date(),
  tz: z.string(),
  weight_kg: z.number().min(WEIGH_IN_MIN_KG).max(WEIGH_IN_MAX_KG),
  source: z.enum(["manual", "healthkit", "health_connect", "import"]),
  note: z.string().nullable(),
});

export type WeighIn = z.infer<typeof weighInSchema>;
