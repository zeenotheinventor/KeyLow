import {
  describeHeatStep,
  describeHours,
  describePlannedSessions,
  describeSets,
  describeShortDate,
  describeWeekdayName,
  describeWeekRange,
  formatSetCount,
  VOLUME_STATUS_NAMES,
} from "./bodyMap";
import { MUSCLE_GROUP_NAMES, MUSCLE_NAMES, NAME_NUMBER } from "./muscleNames";
import { MUSCLES } from "../training/muscles";

import type { PlannedSession } from "./bodyMap";
import type { LastTrained, MuscleDetail } from "../training/muscleDetail";
import type { MuscleId } from "../training/muscles";

/*
 * The words of the muscle sheet (`body · muscle-sheet`, `body · muscle-sheet-not-targeted`, now the Not trained case) from a
 * `MuscleDetail`. Data in, sentence out: every number comes from the detail or the context.
 */

/** The fixed words of the sheet, as the boards draw them. */
export const MUSCLE_SHEET = {
  heatLabel: "Heat",
  readyLabel: "Ready",
  readyNow: "Now",
  thisWeekLabel: "This week",
  lastTrainedLabel: "Last trained",
  barStart: "0",
  editRoutine: "Edit routine",
  weightingNote: "Sets count by how much an exercise works the muscle.",
} as const;

/** An exercise whose set counts as a share of a set for the muscle, to make the weighting note concrete. */
export type WeightingExample = Readonly<{
  /** The exercise as the sentence names it, in lower case, such as "shoulder press". */
  exerciseName: string;
  /** The share of a set it counts as for the muscle, from its muscle map. */
  weight: number;
}>;

export type MuscleSheetContext = Readonly<{
  /** The Monday that starts the week the sheet counts, `YYYY-MM-DD`. */
  weekStart: string;
  /** The sessions of the plan still to come this week, in date order. */
  upcomingSessions: readonly PlannedSession[];
  /** `heatWindowDays` of the training params: how far back "last trained" looks. */
  heatWindowDays: number;
  weightingExample: WeightingExample | null;
}>;

export type HeatTileCopy = { label: string; value: string; stepName: string };

export type LastTrainedCopy = {
  label: string;
  /** The day and the routine day, or that the muscle was not trained in the window. */
  value: string;
  /** The exercises of that day with their set counts, or null when there is no entry. */
  exercises: string | null;
};

export type TrainedMuscleSheetCopy = {
  kind: "trained";
  title: string;
  /** The muscle's group. The goal priority clause of the board needs the goal, which a detail does not hold. */
  subtitle: string;
  heat: HeatTileCopy;
  ready: { label: string; value: string; caption: string | null };
  weeklySets: {
    heading: string;
    plannedText: string;
    done: { value: string; caption: string };
    barName: string;
    /** The words under the bar: the start, and where Growing, Productive and High begin. */
    barLabels: { start: string; growing: string; productive: string; high: string };
    position: string;
  };
  lastTrained: LastTrainedCopy;
  weightingNote: string;
};

export type NotTrainedMuscleSheetCopy = {
  kind: "not_trained";
  title: string;
  subtitle: string;
  heat: HeatTileCopy;
  thisWeek: { label: string; value: string; statusName: string };
  explanation: string;
  lastTrained: LastTrainedCopy;
  actions: { editRoutine: string };
  footnote: string;
};

export type MuscleSheetCopy = TrainedMuscleSheetCopy | NotTrainedMuscleSheetCopy;

const heatTile = ({ heatPercent, heatStep }: MuscleDetail): HeatTileCopy => ({
  label: MUSCLE_SHEET.heatLabel,
  value: `${heatPercent} %`,
  stepName: describeHeatStep(heatStep),
});

const lastTrainedBlock = (
  lastTrained: LastTrained | null,
  heatWindowDays: number,
): LastTrainedCopy => {
  if (lastTrained === null) {
    return {
      label: MUSCLE_SHEET.lastTrainedLabel,
      value: `Not in the last ${heatWindowDays === 1 ? "day" : `${heatWindowDays} days`}`,
      exercises: null,
    };
  }
  const day = describeShortDate(lastTrained.localDate);
  return {
    label: MUSCLE_SHEET.lastTrainedLabel,
    value: lastTrained.routineDayName === null ? day : `${day} · ${lastTrained.routineDayName}`,
    exercises: lastTrained.exercises
      .map(({ name, sets }) => `${name}, ${describeSets(sets)}`)
      .join(" · "),
  };
};

const describePosition = (
  { actual, planned, actualStatus, plannedStatus }: MuscleDetail["weeklySets"],
  upcomingSessions: readonly PlannedSession[],
): string => {
  const soFar = `${VOLUME_STATUS_NAMES[actualStatus]} so far.`;
  const more = formatSetCount(planned - actual);
  if (planned <= actual || Number(more) === 0) {
    return `${soFar} Nothing more is planned this week.`;
  }
  const subject =
    upcomingSessions.length === 0
      ? "The plan adds"
      : `${describePlannedSessions(upcomingSessions)} ${upcomingSessions.length === 1 ? "plans" : "plan"}`;
  const reaches =
    plannedStatus === actualStatus
      ? `still ${VOLUME_STATUS_NAMES[plannedStatus]}`
      : `into ${VOLUME_STATUS_NAMES[plannedStatus]}`;
  return `${soFar} ${subject} ${more} more, which brings the week to ${formatSetCount(planned)}, ${reaches}.`;
};

const describeShare = (weight: number): string => {
  if (weight === 0.5) {
    return "half a set";
  }
  return weight === 1 ? "a whole set" : `${formatSetCount(weight)} of a set`;
};

const withArticle = (name: string): string => (/^[aeiou]/.test(name) ? `an ${name}` : `a ${name}`);

const describeWeightingNote = (muscle: MuscleId, example: WeightingExample | null): string =>
  example === null
    ? MUSCLE_SHEET.weightingNote
    : `${MUSCLE_SHEET.weightingNote.replace(/\.$/, "")}, so ${withArticle(example.exerciseName)} set counts as ${describeShare(example.weight)} for ${MUSCLE_NAMES[muscle].toLowerCase()}.`;

const describeRecoveredFrom = (localDate: string, weekStart: string): string =>
  // A bare weekday is ambiguous for a day before this week.
  localDate < weekStart ? describeShortDate(localDate) : describeWeekdayName(localDate);

const readyTile = (
  { readyInHours, lastTrained }: MuscleDetail,
  weekStart: string,
): TrainedMuscleSheetCopy["ready"] => {
  const readyNow = readyInHours === 0;
  return {
    label: MUSCLE_SHEET.readyLabel,
    value: readyNow ? MUSCLE_SHEET.readyNow : `In ${describeHours(readyInHours)}`,
    caption:
      readyNow && lastTrained !== null
        ? `Recovered from ${describeRecoveredFrom(lastTrained.localDate, weekStart)}`
        : null,
  };
};

const describeTrainedSheet = (
  detail: MuscleDetail,
  { weekStart, upcomingSessions, heatWindowDays, weightingExample }: MuscleSheetContext,
): TrainedMuscleSheetCopy => {
  const { actual, planned, bands, actualStatus } = detail.weeklySets;
  // The sets done are named by their own band. The view's status colours the bar and nothing here.
  const statusName = VOLUME_STATUS_NAMES[actualStatus];
  const bandRule = `Growing from ${describeSets(bands.growingFromSets)}, Productive from ${bands.productiveFromSets}, High above ${bands.highAboveSets}`;
  return {
    kind: "trained",
    title: MUSCLE_NAMES[detail.muscle],
    subtitle: MUSCLE_GROUP_NAMES[MUSCLES[detail.muscle].group],
    heat: heatTile(detail),
    ready: readyTile(detail, weekStart),
    weeklySets: {
      heading: `Sets this week · ${describeWeekRange(weekStart)}`,
      plannedText: `${formatSetCount(planned)} planned`,
      done: { value: formatSetCount(actual), caption: `done · ${statusName}` },
      barName: `${describeSets(actual)} done, ${statusName}, ${formatSetCount(planned)} planned. ${bandRule}`,
      barLabels: {
        start: MUSCLE_SHEET.barStart,
        growing: String(bands.growingFromSets),
        productive: String(bands.productiveFromSets),
        high: String(bands.highAboveSets),
      },
      position: describePosition(detail.weeklySets, upcomingSessions),
    },
    lastTrained: lastTrainedBlock(detail.lastTrained, heatWindowDays),
    weightingNote: describeWeightingNote(detail.muscle, weightingExample),
  };
};

const describeNotTrainedSheet = (
  detail: MuscleDetail,
  { heatWindowDays }: MuscleSheetContext,
): NotTrainedMuscleSheetCopy => {
  const plain = MUSCLE_NAMES[detail.muscle].toLowerCase();
  const object = NAME_NUMBER[detail.muscle] === "one" ? "it" : "them";
  return {
    kind: "not_trained",
    title: MUSCLE_NAMES[detail.muscle],
    subtitle: `${MUSCLE_GROUP_NAMES[MUSCLES[detail.muscle].group]} · not trained this week`,
    heat: heatTile(detail),
    thisWeek: {
      label: MUSCLE_SHEET.thisWeekLabel,
      value: describeSets(detail.weeklySets.actual),
      statusName: VOLUME_STATUS_NAMES.not_trained,
    },
    explanation: `No sets for ${plain} this week, which runs Monday to Sunday. Any working set for ${plain} moves ${object} to ${VOLUME_STATUS_NAMES.maintaining}.`,
    lastTrained: lastTrainedBlock(detail.lastTrained, heatWindowDays),
    actions: { editRoutine: MUSCLE_SHEET.editRoutine },
    footnote: `Add an exercise that works ${plain} to your routine, and its sets count here.`,
  };
};

/**
 * The words of the sheet for one muscle. A muscle with no sets done and none planned this week gets the
 * sheet that says so and offers Edit routine. Any other muscle gets the sets-this-week sheet, with its bar.
 */
export const describeMuscleSheet = (
  detail: MuscleDetail,
  context: MuscleSheetContext,
): MuscleSheetCopy =>
  detail.weeklySets.actual === 0 && detail.weeklySets.planned === 0
    ? describeNotTrainedSheet(detail, context)
    : describeTrainedSheet(detail, context);
