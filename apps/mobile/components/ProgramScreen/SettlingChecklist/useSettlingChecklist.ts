import { useSettlingChecklist as useSettlingChecklistRead } from "@keylow/api-client";

import { useReadsEnabled } from "../../../lib/useReadsEnabled";

import type { SettlingChecklistProps } from "./types";
import type { SettlingChecklistView } from "@keylow/core/program";

/**
 * What the first check-in needs so far: the shared read, held off while the terms are not accepted. Null until
 * all of it has been read, so a count of 0 is never drawn for a count that is not known.
 */
export function useSettlingChecklist({
  firstCheckinDate,
  daysLeft,
  today,
}: SettlingChecklistProps): SettlingChecklistView | null {
  return useSettlingChecklistRead({
    firstCheckinDate,
    daysLeft,
    today,
    enabled: useReadsEnabled(),
  });
}
