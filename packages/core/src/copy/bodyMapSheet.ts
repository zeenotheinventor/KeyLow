import {
  describeHeatStep,
  describeHours,
  describePlannedSessions,
  describeSets,
  describeShortDate,
  describeWeekdayName,
  describeWeekRange,
  formatSetCount,
} from "./bodyMap";
import { MUSCLE_GROUP_NAMES, MUSCLE_NAMES, NAME_NUMBER } from "./muscleNames";
import { MUSCLES } from "../training/muscles";

import type { PlannedSession } from "./bodyMap";
import type { LastTrained, MuscleDetail, RangePosition } from "../training/muscleDetail";
import type { MuscleId } from "../training/muscles";

/*
 * The words of the muscle sheet (`body · muscle-sheet`, `body · muscle-sheet-not-targeted`) from a
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
  editGoal: "Edit goal",
  notTargetedStatus: "Not targeted",
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

export type TargetedMuscleSheetCopy = {
  kind: "targeted";
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
    barLabels: { start: string; minimum: string; planned: string; maximum: string };
    position: string;
  };
  lastTrained: LastTrainedCopy;
  weightingNote: string;
};

export type NotTargetedMuscleSheetCopy = {
  kind: "not_targeted";
  title: string;
  subtitle: string;
  heat: HeatTileCopy;
  thisWeek: { label: string; value: string; statusName: string };
  explanation: string;
  lastTrained: LastTrainedCopy;
  actions: { editRoutine: string; editGoal: string };
  footnote: string;
};

export type MuscleSheetCopy = TargetedMuscleSheetCopy | NotTargetedMuscleSheetCopy;

const POSITION_SO_FAR: Readonly<Record<RangePosition, string>> = {
  below: "Below target so far.",
  inside: "Inside target so far.",
  above: "Above target so far.",
};

const POSITION_BY_END_OF_WEEK: Readonly<Record<RangePosition, string>> = {
  below: "below your target",
  inside: "inside your target",
  above: "above your target",
};

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
  { actual, planned, actualPosition, plannedPosition }: MuscleDetail["weeklySets"],
  upcomingSessions: readonly PlannedSession[],
): string => {
  const soFar = POSITION_SO_FAR[actualPosition];
  const more = formatSetCount(planned - actual);
  if (planned <= actual || Number(more) === 0) {
    return `${soFar} Nothing more is planned this week.`;
  }
  const subject =
    upcomingSessions.length === 0
      ? "The plan adds"
      : `${describePlannedSessions(upcomingSessions)} ${upcomingSessions.length === 1 ? "plans" : "plan"}`;
  return `${soFar} ${subject} ${more} more, which brings the week to ${formatSetCount(planned)}, ${POSITION_BY_END_OF_WEEK[plannedPosition]}.`;
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
): TargetedMuscleSheetCopy["ready"] => {
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

const describeTargetedSheet = (
  detail: MuscleDetail,
  { weekStart, upcomingSessions, heatWindowDays, weightingExample }: MuscleSheetContext,
): TargetedMuscleSheetCopy => {
  const { actual, planned, target } = detail.weeklySets;
  const targetRange = `${target.mav.low} to ${target.mav.high}`;
  return {
    kind: "targeted",
    title: MUSCLE_NAMES[detail.muscle],
    subtitle: MUSCLE_GROUP_NAMES[MUSCLES[detail.muscle].group],
    heat: heatTile(detail),
    ready: readyTile(detail, weekStart),
    weeklySets: {
      heading: `Sets this week · ${describeWeekRange(weekStart)}`,
      plannedText: `${formatSetCount(planned)} planned`,
      done: { value: formatSetCount(actual), caption: `done · target ${targetRange}` },
      barName: `${describeSets(actual)} done, ${formatSetCount(planned)} planned, target ${targetRange}, minimum ${target.mev}, maximum ${target.mrv}`,
      barLabels: {
        start: MUSCLE_SHEET.barStart,
        minimum: `Min ${target.mev}`,
        planned: `Planned ${formatSetCount(planned)}`,
        maximum: `Max ${target.mrv}`,
      },
      position: describePosition(detail.weeklySets, upcomingSessions),
    },
    lastTrained: lastTrainedBlock(detail.lastTrained, heatWindowDays),
    weightingNote: describeWeightingNote(detail.muscle, weightingExample),
  };
};

const describeNotTargetedSheet = (
  detail: MuscleDetail,
  { heatWindowDays }: MuscleSheetContext,
): NotTargetedMuscleSheetCopy => {
  const name = MUSCLE_NAMES[detail.muscle];
  const plain = name.toLowerCase();
  const [object, subject, has, reads, gets] =
    NAME_NUMBER[detail.muscle] === "one"
      ? ["it", "it", "has", "reads", "gets"]
      : ["them", "they", "have", "read", "get"];
  return {
    kind: "not_targeted",
    title: name,
    subtitle: `${MUSCLE_GROUP_NAMES[MUSCLES[detail.muscle].group]} · not targeted`,
    heat: heatTile(detail),
    thisWeek: {
      label: MUSCLE_SHEET.thisWeekLabel,
      value: describeSets(detail.weeklySets.actual),
      statusName: MUSCLE_SHEET.notTargetedStatus,
    },
    explanation: `Your routine does not train ${plain} and your goal does not rank ${object}, so ${subject} ${has} no target this week and never ${reads} as under.`,
    lastTrained: lastTrainedBlock(detail.lastTrained, heatWindowDays),
    actions: { editRoutine: MUSCLE_SHEET.editRoutine, editGoal: MUSCLE_SHEET.editGoal },
    footnote: `Add an exercise that works ${plain} to your routine, or rank ${object} in your goal, and ${subject} ${gets} a target.`,
  };
};

/**
 * The words of the sheet for one muscle. A muscle that is targeted gets the sets-this-week sheet, and one
 * that is not gets the sheet that says why and offers Edit routine and Edit goal.
 */
export const describeMuscleSheet = (
  detail: MuscleDetail,
  context: MuscleSheetContext,
): MuscleSheetCopy =>
  detail.targeting.targeted
    ? describeTargetedSheet(detail, context)
    : describeNotTargetedSheet(detail, context);
