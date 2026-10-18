import { toLocalDate } from "../dates";
import { WEIGH_IN_MAX_KG, WEIGH_IN_MIN_KG } from "./bounds";
import { roundToGram } from "./roundToGram";
import { validateNote } from "./validateNote";

import type { ManualWeighInInsert } from "./types";

type ManualWeighInDraft = Readonly<{
  weightKg: number;
  measuredAt: Date;
  /** The note as typed, or null for none. It is trimmed here, and a blank one is stored as null. */
  note: string | null;
  /** The IANA zone of the profile. */
  timeZone: string;
}>;

/**
 * The row to insert for a weight the user typed. The weight is rounded to 3 decimals, half away from
 * zero, before the bounds are checked, as the column does. Throws a RangeError for a weight outside 20
 * to 400 kg or a note over 200 characters. The message states the rule only, because the weight and
 * the note are health data and must not reach a log.
 */
export function buildManualWeighIn(draft: ManualWeighInDraft): ManualWeighInInsert {
  const weightKg = roundToGram(draft.weightKg);
  if (!(weightKg >= WEIGH_IN_MIN_KG && weightKg <= WEIGH_IN_MAX_KG)) {
    throw new RangeError(
      `A weigh-in weight must be from ${WEIGH_IN_MIN_KG} to ${WEIGH_IN_MAX_KG} kg.`,
    );
  }

  const note = validateNote(draft.note ?? "");
  if (!note.ok) {
    throw new RangeError("A weigh-in note must be 200 characters or fewer.");
  }

  return {
    weight_kg: weightKg,
    measured_at: draft.measuredAt.toISOString(),
    local_date: toLocalDate(draft.measuredAt, draft.timeZone),
    tz: draft.timeZone,
    source: "manual",
    external_id: null,
    note: note.note,
  };
}
