import { useCheckinSummary as useCheckinSummaryRead } from "@keylow/api-client";

import { useReadsEnabled } from "../../../lib/useReadsEnabled";

import type { CheckinSummaryCardProps } from "./types";
import type { CheckinSummaryView } from "@keylow/core/program";

/**
 * What the check-in summary card says: the shared read, held off while the terms are not accepted. Null until
 * it has something true to say, so the card is left out and the rest of the screen stands.
 */
export function useCheckinSummary({
  snapshot,
  programStartedOn,
  unit,
}: Omit<CheckinSummaryCardProps, "isArriving">): CheckinSummaryView | null {
  return useCheckinSummaryRead({ snapshot, programStartedOn, unit, enabled: useReadsEnabled() });
}
