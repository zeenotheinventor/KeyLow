import type { ExpenditureSnapshot, ProgramSummary, Targets, TargetsRow } from "@keylow/api-client";
import type { ExpenditureBelief } from "@keylow/core/engine";
import type { WeightDisplayUnit } from "@keylow/core/weight";

/** The hero: the estimate of what the person burns in a day, in whole kilocalories, with its likely range. */
export type ExpenditureHeroView = {
  /** The accessible name: "Estimated expenditure, 2,580 kilocalories a day, likely 2,430 to 2,730 kcal". */
  name: string;
  kcalText: string;
  /** "Likely 2,430 to 2,730 kcal". */
  rangeText: string;
  /** Under the range: where the estimate comes from, or that it is a starting estimate. */
  captionText: string;
  /** True while the estimate is still the starting one, which adds the Settling badge. */
  isSettling: boolean;
};

export type MacroTilesView = {
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** The next check-in row: "Next check-in", or "First check-in" while settling. */
export type CheckInRowView = {
  title: string;
  caption: string;
  dateText: string;
};

export type WeekTargetsView = {
  name: string;
  kcalText: string;
  sinceText: string;
  /** The rate line, or the guardrail line when a guardrail set the calories. Null when the weight is not known. */
  line: string | null;
  /** True when `line` is a guardrail line, which the card draws with an Info icon before it. */
  isGuardrail: boolean;
  macros: MacroTilesView | null;
  /** Null until the program has a date for its check-in. */
  checkIn: CheckInRowView | null;
};

export type ProgramDetailRow = {
  key: string;
  title: string;
  subtitle: string | undefined;
  value: string;
};

export type ProgramView = {
  hero: ExpenditureHeroView;
  /** Null for a program with no targets to show yet. */
  targets: WeekTargetsView | null;
  details: readonly ProgramDetailRow[];
};

export type ProgramScreenState =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "no-program"; ownTargetKcal: number | null }
  | { status: "program"; view: ProgramView };

export type BuildProgramViewInput = {
  program: NonNullable<ProgramSummary["program"]>;
  latestSnapshot: ExpenditureSnapshot | null;
  previousSnapshot: ExpenditureSnapshot | null;
  currentTargets: TargetsRow | null;
  /** The targets read: what the diary shows, which is all there is to show for a program with no targets row yet. */
  targetsRead: Targets;
  /** The starting estimate worked out on the device from the saved stats, for a program with no snapshot. */
  startBelief: ExpenditureBelief | null;
  /** The weight the rate lines use when the targets row does not say, which is the one the starting estimate used. */
  fallbackWeightKg: number | null;
  unit: WeightDisplayUnit;
  /** The user's local date, `YYYY-MM-DD`. */
  today: string;
};
