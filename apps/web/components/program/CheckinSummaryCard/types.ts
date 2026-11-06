import type { ExpenditureSnapshot } from "@keylow/api-client";
import type { WeightDisplayUnit } from "@keylow/core/weight";

/** The newest snapshot, a check-in's. */
export type CheckinSnapshot = Extract<ExpenditureSnapshot, { kind: "checkin" }>;

export type CheckinSummaryCardProps = {
  /** The programme's newest snapshot, which is a check-in. */
  snapshot: CheckinSnapshot;
  /** The day the active programme began, `YYYY-MM-DD`: targets rows from before it are another programme's. */
  programStartedOn: string;
  unit: WeightDisplayUnit;
  /** Set on the first open after a new check-in, and false otherwise. */
  isArriving: boolean;
};
