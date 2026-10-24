import type { ExpenditureSnapshot, TargetsRow } from "@keylow/api-client";
import type { WeightDisplayUnit } from "@keylow/core/weight";

/** The newest snapshot, a check-in's. */
export type CheckinSnapshot = Extract<ExpenditureSnapshot, { kind: "checkin" }>;

export type CheckinSummaryCardProps = {
  /** The programme's newest snapshot, which is a check-in. */
  snapshot: CheckinSnapshot;
  /** The day the active programme began, `YYYY-MM-DD`: targets rows from before it are another programme's. */
  programStartedOn: string;
  unit: WeightDisplayUnit;
  /** True on the first open after this check-in, when the card cuts in. It is read when the card is mounted. */
  isArriving: boolean;
};

/** The check-in's own targets row, and the row of the same programme that held before it. */
export type CheckinTargetsRows = {
  targets: TargetsRow;
  previousTargets: TargetsRow;
};

/** The four kinds of line: the data line, a guardrail, a reason the week did not measure, and a plain line. */
export type SummaryLineKind = "data" | "guardrail" | "reason" | "plain";

export type SummaryLineView = {
  kind: SummaryLineKind;
  text: string;
};

/** One of the two rows, "Expenditure" and "Calorie target". */
export type SummaryRowView = {
  label: string;
  value: string;
  /** "Expenditure: 2,500 to 2,560 kcal". */
  name: string;
};

export type CheckinSummaryView = {
  /** "Last check-in, Friday 9 October, measured". */
  name: string;
  /** "Friday 9 October". */
  dateText: string;
  isMeasured: boolean;
  rows: readonly SummaryRowView[];
  lines: readonly SummaryLineView[];
};
