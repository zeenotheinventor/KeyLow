import { describeShortDate } from "./bodyMap";
import { describeCount } from "./counts";
import {
  EXERCISE_TREND,
  describeTrendChange,
  describeTrendMovement,
  describeTrendValue,
} from "./exerciseTrend";

import type { ExerciseTrend, TrendEntry, TrendRange, TrendValue } from "../training/exerciseTrend";
import type { LoadUnit } from "../training/loads";

/**
 * The words of the Progress section on the Routines page, which no board draws (Zee waived the design gate
 * for KEY-508 on 2026-10-19 and 2026-10-20): its heading, and the line of an exercise not trained this week.
 */
export const ROUTINE_PROGRESS = {
  heading: "Progress",
  notTrainedThisWeek: "Not trained this week",
} as const;

/** The words of the exercise progress screen, which no board draws either. */
export const EXERCISE_PROGRESS = {
  /** The title while the exercise's name is not known, such as offline, where the name is not kept. */
  fallbackTitle: "Exercise progress",
  backLabel: "Back to Routines",
  loadingName: "Loading progress",
  rangeLabel: "Range",
  ranges: { "4w": "4 weeks", "3m": "3 months", "1y": "1 year" } satisfies Record<
    TrendRange,
    string
  >,
  weeksHeading: "Weeks",
  notTrained: "Not trained",
  /** Under the value of an exercise trained in one week only. */
  secondWeekNeeded: "Train this exercise in a second week to see a change.",
  empty: {
    title: "No sets logged yet",
    body: "Log a working set of this exercise and its weekly progress shows here.",
  },
} as const;

/** A week's value with its reps: "60 kg for 8 reps". A week with no load is its reps alone: "12 reps". */
export const describeTrendWeek = (value: TrendValue, unit: LoadUnit): string =>
  value.loadKg === null
    ? describeTrendValue(value, unit)
    : `${describeTrendValue(value, unit)} for ${describeCount(value.reps, "rep", "reps")}`;

/** A change that moved: the words, with the sign, and which way it went. The sign carries it as well as the colour. */
export type ProgressChange<Direction extends "up" | "down" | null = "up" | "down"> = Readonly<{
  text: string;
  direction: Direction;
}>;

/** What an exercise's row on the Routines page says. */
export type ProgressRowWords = Readonly<{
  /** The line under the name: this week's value, or when this week is a gap, the last value. */
  line: string;
  /** How this week moved. Null for a first week, an equal week, a gap and an exercise never trained. */
  change: ProgressChange | null;
  /** The row said in full, for a screen reader: "Bench press, 60 kg for 8 reps, up 5 kg on the last trained week". */
  accessibleName: string;
}>;

/**
 * An exercise's row: the value of this week (the last week of the trend) and the reps of that set, and how
 * it moved against the last week trained. A gap this week says so, with the last value, and has no change.
 */
export const describeProgressRow = ({
  name,
  trend,
  unit,
}: {
  name: string;
  trend: ExerciseTrend;
  unit: LoadUnit;
}): ProgressRowWords => {
  const { latest, weeks } = trend;
  if (latest === null) {
    return {
      line: EXERCISE_TREND.notTrainedYet,
      change: null,
      accessibleName: `${name}, ${EXERCISE_TREND.notTrainedYet.toLowerCase()}`,
    };
  }

  const value = describeTrendWeek(latest.value, unit);
  if (latest.weekStart !== weeks.at(-1)?.weekStart) {
    const line = `${ROUTINE_PROGRESS.notTrainedThisWeek}, last ${value}`;
    return { line, change: null, accessibleName: `${name}, ${line.toLowerCase()}` };
  }

  const movement = describeTrendMovement(latest.change, unit);
  if (movement === null) {
    return { line: value, change: null, accessibleName: `${name}, ${value}` };
  }
  return {
    line: value,
    change: {
      text: describeTrendChange(latest.change, unit),
      direction: movement.direction,
    },
    accessibleName: `${name}, ${value}, ${movement.direction} ${movement.amount} on the last trained week`,
  };
};

/** A week of the list on the graph screen. */
export type ProgressWeekWords = Readonly<{
  /** The Monday the week starts on: "Mon 14 Sep". */
  weekLabel: string;
  /** The value and its reps, or null for a skipped week. */
  value: string | null;
  /** The change in words ("+2.5 kg", "No change", "First week"), with its direction when it moved. Null for a skipped week. */
  change: ProgressChange<"up" | "down" | null> | null;
  accessibleName: string;
}>;

/** A week of the list on the graph screen: the Monday, the value with its reps, and the change as text. A skipped week says "Not trained". */
export const describeProgressWeek = (entry: TrendEntry, unit: LoadUnit): ProgressWeekWords => {
  const weekLabel = describeShortDate(entry.weekStart);
  if (entry.value === null) {
    return {
      weekLabel,
      value: null,
      change: null,
      accessibleName: `${weekLabel}, ${EXERCISE_PROGRESS.notTrained}`,
    };
  }

  const value = describeTrendWeek(entry.value, unit);
  const text = describeTrendChange(entry.change, unit);
  return {
    weekLabel,
    value,
    change: { text, direction: describeTrendMovement(entry.change, unit)?.direction ?? null },
    accessibleName: `${weekLabel}, ${value}, ${text}`,
  };
};

/**
 * What a screen reader says for the whole chart, which is also written under it: the exercise, how many
 * weeks it covers, and the first and last value trained, such as "Bench press, 13 weeks, from 55 kg to 62.5 kg".
 */
export const describeProgressChartSummary = ({
  name,
  trend,
  unit,
}: {
  name: string;
  trend: ExerciseTrend;
  unit: LoadUnit;
}): string => {
  const trained = trend.weeks.flatMap(({ value }) => (value === null ? [] : [value]));
  const first = trained[0];
  const last = trained.at(-1);
  const weeks = `${name}, ${trend.weeks.length} weeks`;

  if (first === undefined || last === undefined) {
    return `${weeks}, ${EXERCISE_TREND.notTrainedYet.toLowerCase()}`;
  }
  return trained.length === 1
    ? `${weeks}, ${describeTrendValue(first, unit)} in one week`
    : `${weeks}, from ${describeTrendValue(first, unit)} to ${describeTrendValue(last, unit)}`;
};
