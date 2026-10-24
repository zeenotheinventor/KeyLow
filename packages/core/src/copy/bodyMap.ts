import { describeDateInWords } from "./diary";
import { MONTH_NAMES_SHORT, WEEKDAY_NAMES_LONG, WEEKDAY_NAMES_SHORT } from "./diaryDay";
import { MUSCLE_NAMES } from "./muscleNames";
import {
  addCalendarDays,
  dayNumber,
  MILLISECONDS_PER_DAY,
  parseCalendarDay,
} from "../dates/calendarDay";
import { formatClockTime } from "../dates/formatClockTime";
import { toLocalDate } from "../dates/toLocalDate";

import type { BodyArtworkFigure, BodyArtworkSide } from "../training/bodyArtwork";
import type { BodyMapView, GAP_VALUES, WarmMuscle } from "../training/bodyMapValues";
import type { MuscleListRow } from "../training/muscleList";
import type { MuscleId } from "../training/muscles";
import type { VolumeStatus } from "../training/muscleState";

/*
 * The words of the body map (KEY-340) as the boards `body · *`, `web-body · *`, `dashboard · training-card`
 * and the body map card of `train · *` draw them. Data in, sentence out: every number and date in a sentence
 * comes from the input.
 */

export type BodyMapScale = "heat" | "volume" | "gap";

/** A value of the gap scale, as `GAP_VALUES` lists them: the number `gapValues` writes is an index in it. */
export type GapValue = (typeof GAP_VALUES)[number];

/** A session of the week's plan, named by its calendar day (`YYYY-MM-DD`) and the routine day it is. */
export type PlannedSession = Readonly<{ localDate: string; routineDayName: string | null }>;

/** A heat step as `heatStepOf` writes it, 0 (rested), 1 (ready) to 5 (peak). */
export type HeatStep = 0 | 1 | 2 | 3 | 4 | 5;

/** The name of each heat step, keyed by the step. */
export const HEAT_STEP_NAMES: Readonly<Record<HeatStep, string>> = {
  0: "Rested",
  1: "Ready",
  2: "Warm",
  3: "Hot",
  4: "Very hot",
  5: "Peak",
};

/**
 * The name of each volume status, keyed by the status. The boards' legend lists "Not targeted" first and
 * `VOLUME_STATUSES` lists it last, so a word is always read through the status, never by position.
 */
export const VOLUME_STATUS_NAMES: Readonly<Record<VolumeStatus, string>> = {
  under: "Under",
  maintaining: "Maintaining",
  productive: "Productive",
  over: "Over",
  not_targeted: "Not targeted",
};

/** The name of each gap value, keyed by the value. The same holds for "Not in plan", which the legend lists first. */
export const GAP_VALUE_NAMES: Readonly<Record<GapValue, string>> = {
  behind: "Behind",
  on_plan: "On plan",
  ahead: "Ahead",
  not_in_plan: "Not in plan",
};

const isHeatStep = (step: number): step is HeatStep => Object.hasOwn(HEAT_STEP_NAMES, step);

/** The name of a heat step as `heatValues` and `heatStepOf` write it. Throws a `RangeError` naming the rule for any other number. */
export const describeHeatStep = (step: number): string => {
  if (!isHeatStep(step)) {
    throw new RangeError("A heat step must be a whole number from 0 to 5");
  }
  return HEAT_STEP_NAMES[step];
};

/** The legend of each scale in the order the boards draw it, which puts "not targeted" and "not in plan" first. */
export const BODY_MAP_LEGEND_ITEMS = {
  heat: [0, 1, 2, 3, 4, 5].map(describeHeatStep),
  volume: [
    VOLUME_STATUS_NAMES.not_targeted,
    VOLUME_STATUS_NAMES.under,
    VOLUME_STATUS_NAMES.maintaining,
    VOLUME_STATUS_NAMES.productive,
    VOLUME_STATUS_NAMES.over,
  ],
  gap: [
    GAP_VALUE_NAMES.not_in_plan,
    GAP_VALUE_NAMES.behind,
    GAP_VALUE_NAMES.on_plan,
    GAP_VALUE_NAMES.ahead,
  ],
} as const;

/** The words of the body map that do not depend on any number, as the boards draw them. */
export const BODY_MAP = {
  title: "Body map",
  listTitle: "Muscles",
  /** The back button where the screen opens from anywhere but the Train home: the dashboard, or a cold link. */
  back: "Back",
  backToTrain: "Back to Train",
  muscleListButton: "Muscle list",
  closeSheet: "Close",
  /** The screen reader action on a muscle that opens its sheet, which a long press does for a finger. */
  muscleDetailsAction: "Show details",
  sideBySideName: "Show side by side",
  scaleSwitch: { name: "Scale", heat: "Heat", volume: "Volume", gap: "Gap" },
  sideSwitch: { name: "Side shown", front: "Front", back: "Back" },
  /** What the Front / Back control does to the 3D body, for a screen reader, since a drag alone must not be the only way. */
  sideSwitchDescription: "Turns the body to face front or back.",
  /** The hint under the 3D body. Later gestures add to it: the board ends "Pinch to zoom · Long-press a muscle for details". */
  rotateHint: "Drag to turn",
  /** Over the 2D figure while the 3D body loads, at the corner of the stage. It goes when the 3D body has drawn or has failed. */
  loading3d: "Loading 3D…",
  /** Added to the figure's name while the 3D body loads, as the loading board names it. */
  loading3dLabel: "3D is loading.",
  legendNames: { heat: "Heat legend", volume: "Volume legend", gap: "Gap legend" },
  views: { actual: "Actual", projected: "Projected", gap: "Done against plan" },
  toggle: {
    showProjected: "Show projected",
    showActual: "Show actual",
    projectedNeedsRoutine: "Projected needs a routine.",
  },
  notes: {
    todayProjected:
      "Today, Projected shows what you have logged. A planned session counts from the next day, so pick a later day to see where your plan takes you.",
    sideBySide: "Both views show, so tapping the figures changes nothing here.",
    gap: "Gap compares this week's sets with your plan, so it has no Actual or Projected.",
    gapSoFar: "It counts your planned days up to yesterday, and today once you have logged it.",
  },
  coachMark: { text: "Long-press a muscle for details", dismiss: "Got it" },
  emptyState: {
    title: "Nothing to show yet",
    body: "Log a session and the muscles you train warm up here, then cool over a day or two as they recover.",
    action: "Start a session",
  },
  scrubber: {
    name: "Day shown",
    availableInProjected: "available in Projected",
    projectedNeedsRoutine: "Projected needs a routine",
  },
  figureLabels: {
    finishCard: { front: "This session's heat, front", back: "This session's heat, back" },
    goalsSummary: {
      front: "Your priorities on the body map, front",
      back: "Your priorities on the body map, back",
    },
  },
  figureHints: {
    muscleList: "The muscle list has each muscle’s values.",
    openBodyMap: "Open the body map for each muscle.",
  },
  dashboardCard: {
    title: "Training",
    view: "Actual · now",
    link: "Body map",
    hottestStep: HEAT_STEP_NAMES[5],
    coolestStep: HEAT_STEP_NAMES[0],
    restDay: "Rest day",
    open: "Open the body map",
    loadingLabel: "Loading the body map",
    loadFailed: "Couldn't load the body map",
    offlineUnavailable: "The body map isn't available offline.",
  },
  trainCard: { openName: "Open body map" },
  figureSetting: {
    label: "Figure: male or female",
    sheetTitle: "Figure",
    description: "This changes how the body is drawn. Nothing else changes.",
    options: { male: "Male", female: "Female" },
  },
} as const;

const HEAT_LEGEND_CAPTION =
  "How hard and how recently each muscle worked. It cools as you recover.";
const WEB_HEAT_LEGEND_ADDITION = "Press and hold a muscle, or pick it below, for its details.";
const VOLUME_LEGEND_CAPTION = "Sets this week against each muscle's target.";

/** Items as a sentence lists them: "A", "A and B", "A, B and C". */
export const joinInWords = (items: readonly string[]): string => {
  const last = items.at(-1) ?? "";
  return items.length < 2 ? last : `${items.slice(0, -1).join(", ")} and ${last}`;
};

/** A set count as a number: whole, or to two decimals at most, so floating point drift never shows. */
export const formatSetCount = (count: number): string => String(Math.round(count * 100) / 100);

const setWord = (count: number): string => (count === 1 ? "set" : "sets");

/** A count of sets: "1 set", "0 sets", "5.5 sets". Only exactly one is singular. */
export const describeSets = (count: number): string => `${formatSetCount(count)} ${setWord(count)}`;

const weekdayIndexOf = (localDate: string): number =>
  new Date(dayNumber(localDate) * MILLISECONDS_PER_DAY).getUTCDay();

/** The full name of the weekday of a calendar day (`YYYY-MM-DD`): "Monday". */
export const describeWeekdayName = (localDate: string): string =>
  `${WEEKDAY_NAMES_LONG[weekdayIndexOf(localDate)]}`;

/** The short name of the weekday of a calendar day (`YYYY-MM-DD`): "Mon". */
export const describeWeekdayShortName = (localDate: string): string =>
  `${WEEKDAY_NAMES_SHORT[weekdayIndexOf(localDate)]}`;

/** A calendar day (`YYYY-MM-DD`) as the boards write it: "Mon 12 Oct". */
export const describeShortDate = (localDate: string): string => {
  const { month, day } = parseCalendarDay(localDate);
  return `${WEEKDAY_NAMES_SHORT[weekdayIndexOf(localDate)]} ${day} ${MONTH_NAMES_SHORT[month - 1]}`;
};

/**
 * The seven days from a Monday: "Mon 12 to Sun 18 Oct", with the month named once when both ends share it
 * and on both ends when they do not.
 */
export const describeWeekRange = (weekStart: string): string => {
  const weekEnd = addCalendarDays(weekStart, 6);
  const sameMonth = parseCalendarDay(weekStart).month === parseCalendarDay(weekEnd).month;
  const start = sameMonth
    ? `${WEEKDAY_NAMES_SHORT[weekdayIndexOf(weekStart)]} ${parseCalendarDay(weekStart).day}`
    : describeShortDate(weekStart);
  return `${start} to ${describeShortDate(weekEnd)}`;
};

/** An instant in the user's zone as the boards write a moment: "Thu 15 Oct, 19:00". */
export const describeMoment = (at: string, tz: string): string => {
  const instant = new Date(at);
  return `${describeShortDate(toLocalDate(instant, tz))}, ${formatClockTime(instant, tz)}`;
};

/** The offline Train card's line: "Saved · Thu 15 Oct, 17:52". */
export const describeSavedMoment = (savedAt: string, tz: string): string =>
  `Saved · ${describeMoment(savedAt, tz)}`;

/** Sessions of the plan as owned by their day: "Saturday's Push", "Friday's Pull and Saturday's Push". */
export const describePlannedSessions = (sessions: readonly PlannedSession[]): string =>
  joinInWords(
    sessions.map(
      ({ localDate, routineDayName }) =>
        `${describeWeekdayName(localDate)}'s ${routineDayName ?? "session"}`,
    ),
  );

const ifYouDo = (sessions: readonly PlannedSession[]): string =>
  `if you do ${describePlannedSessions(sessions)}`;

/** What a projection assumes, as the side by side board captions it: "If you do Saturday's Push". */
export const describeProjectedAssumption = (sessions: readonly PlannedSession[]): string => {
  const assumption = ifYouDo(sessions);
  return assumption.charAt(0).toUpperCase() + assumption.slice(1);
};

/** The sub-line of an empty body map: "Nothing logged in the last 14 days". */
export const describeNothingLogged = (heatWindowDays: number): string =>
  `Nothing logged in the last ${heatWindowDays === 1 ? "day" : `${heatWindowDays} days`}`;

export type LegendCaptionInput = Readonly<{
  scale: BodyMapScale;
  /** The web boards write a longer caption for heat and volume than the phone boards. */
  surface: "mobile" | "web";
  /** `onPlanToleranceSets` of the compare params, which the gap caption states. */
  onPlanToleranceSets: number;
}>;

/** The caption under a scale's legend. */
export const describeLegendCaption = ({
  scale,
  surface,
  onPlanToleranceSets,
}: LegendCaptionInput): string => {
  if (scale === "gap") {
    return `Sets done against your plan for the week. On plan means within ${describeSets(onPlanToleranceSets)}.`;
  }
  if (scale === "heat") {
    return surface === "web"
      ? `${HEAT_LEGEND_CAPTION} ${WEB_HEAT_LEGEND_ADDITION}`
      : HEAT_LEGEND_CAPTION;
  }
  return surface === "web"
    ? `${VOLUME_LEGEND_CAPTION} A muscle your routine and goal leave out is not targeted, so it never reads as under.`
    : `${VOLUME_LEGEND_CAPTION} Over means above the maximum.`;
};

export type BodyMapHeaderInput<Scale extends BodyMapScale = BodyMapScale> = Readonly<{
  scale: Scale;
  view: BodyMapView;
  /** The instant the map shows: `now` on today, 20:00 on another day. */
  at: string;
  tz: string;
  isToday: boolean;
  /** The Sunday that ends the week, `YYYY-MM-DD`. */
  weekEnd: string;
  /** The planned sessions a projection to `at` assumes are done, in date order. */
  plannedSessions: readonly PlannedSession[];
}>;

export type BodyMapHeader = {
  viewLabel: string;
  subLine: string;
  /** The view toggle's name, or null on the gap, which has no Actual or Projected. */
  toggleLabel: string | null;
};

/**
 * The view label, the line under it and the toggle button's name, for the scale and view shown. Heat and
 * Volume always have a toggle, so for those scales the name is a string and never null.
 */
export function describeBodyMapHeader(
  input: BodyMapHeaderInput<"heat" | "volume">,
): BodyMapHeader & { toggleLabel: string };
export function describeBodyMapHeader(input: BodyMapHeaderInput): BodyMapHeader;
export function describeBodyMapHeader({
  scale,
  view,
  at,
  tz,
  isToday,
  weekEnd,
  plannedSessions,
}: BodyMapHeaderInput): BodyMapHeader {
  const moment = describeMoment(at, tz);
  const weekSoFar = `This week · as of ${moment}`;
  if (scale === "gap") {
    return { viewLabel: BODY_MAP.views.gap, subLine: weekSoFar, toggleLabel: null };
  }
  const projected = view === "projected";
  const toggleLabel = projected ? BODY_MAP.toggle.showActual : BODY_MAP.toggle.showProjected;
  const viewLabel = BODY_MAP.views[view];
  if (scale === "volume") {
    const subLine = projected
      ? `By ${describeShortDate(weekEnd)}, if you follow the plan`
      : weekSoFar;
    return { viewLabel, subLine, toggleLabel };
  }
  if (isToday) {
    return { viewLabel, subLine: `Now · ${moment}`, toggleLabel };
  }
  const assumption =
    projected && plannedSessions.length > 0 ? ` · ${ifYouDo(plannedSessions)}` : "";
  return { viewLabel, subLine: `${moment}${assumption}`, toggleLabel };
}

/**
 * The note under the gap map: it has no Actual or Projected, and when planned sessions were missed it
 * says so, naming what that left behind (for example "push muscles", from the screen's own reading of
 * which muscles are behind).
 */
export const describeGapNote = (
  missedSessions: readonly PlannedSession[],
  behindMuscles: string,
): string => {
  if (missedSessions.length === 0) {
    return BODY_MAP.notes.gap;
  }
  const verb = missedSessions.length === 1 ? "was" : "were";
  return `${BODY_MAP.notes.gap} ${describePlannedSessions(missedSessions)} ${verb} missed, so ${behindMuscles} are behind.`;
};

export type BodyFigureLabelInput = Readonly<{
  scale: BodyMapScale;
  view: BodyMapView;
  side: BodyArtworkSide;
  /** The sentence that follows the front figure's name: where to find each muscle's values, or null for none. */
  hint: "muscleList" | "openBodyMap" | null;
}>;

const SCALE_WORDS = { heat: "heat", volume: "weekly sets", gap: "gap" } as const;

/** The accessible name of a body figure: "Body map, Actual, heat, front. The muscle list has each muscle's values." */
export const describeBodyFigureLabel = ({
  scale,
  view,
  side,
  hint,
}: BodyFigureLabelInput): string => {
  const viewLabel = scale === "gap" ? BODY_MAP.views.gap : BODY_MAP.views[view];
  const name = `${BODY_MAP.title}, ${viewLabel}, ${SCALE_WORDS[scale]}, ${side}`;
  return hint === null ? name : `${name}. ${BODY_MAP.figureHints[hint]}`;
};

/** The figure's name while the 3D body loads: the name, then that 3D is loading. */
export const describeBodyFigureLoading3d = (label: string): string =>
  `${label.endsWith(".") ? label : `${label}.`} ${BODY_MAP.loading3dLabel}`;

export type ScrubberDayInput = Readonly<{
  /** The calendar day, `YYYY-MM-DD`. */
  localDate: string;
  isToday: boolean;
  state:
    | { kind: "logged" | "planned" | "missed" | "in_progress"; routineDayName: string | null }
    | { kind: "rest" };
  /** The day is after today, so only Projected can show it. */
  onlyInProjected: boolean;
  /** There is no routine, so Projected is off. A day only Projected can show then says why it cannot be picked. */
  projectedNeedsRoutine: boolean;
}>;

export type ScrubberDay = {
  /** The column head: "Mon". */
  weekday: string;
  /** The day of the month: "12". */
  dayOfMonth: string;
  accessibleName: string;
};

const describeScrubberState = (state: ScrubberDayInput["state"]): string => {
  if (state.kind === "rest") {
    return "rest day";
  }
  if (state.kind === "in_progress") {
    return state.routineDayName === null ? "in progress" : `${state.routineDayName} in progress`;
  }
  return [state.routineDayName, state.kind].filter((part) => part !== null).join(", ");
};

/** One day of the scrubber: its column head and a name such as "Thursday 15 October, today, Legs in progress". */
export const describeScrubberDay = ({
  localDate,
  isToday,
  state,
  onlyInProjected,
  projectedNeedsRoutine,
}: ScrubberDayInput): ScrubberDay => {
  const whyNotPickable = projectedNeedsRoutine
    ? BODY_MAP.scrubber.projectedNeedsRoutine
    : BODY_MAP.scrubber.availableInProjected;
  const parts = [
    describeDateInWords(localDate),
    ...(isToday ? ["today"] : []),
    describeScrubberState(state),
    ...(onlyInProjected ? [whyNotPickable] : []),
  ];
  return {
    weekday: describeWeekdayShortName(localDate),
    dayOfMonth: String(parseCalendarDay(localDate).day),
    accessibleName: parts.join(", "),
  };
};

/** A count of hours: "1 hour", "31 hours". */
export const describeHours = (hours: number): string =>
  `${hours} ${hours === 1 ? "hour" : "hours"}`;

/** When a muscle is ready, in full: "ready now", "ready in 1 hour", "ready in 31 hours". */
export const describeReadyIn = (readyInHours: number): string =>
  readyInHours === 0 ? "ready now" : `ready in ${describeHours(readyInHours)}`;

/** When a muscle is ready, as the list row writes it: "ready now", "ready in 19 h". */
export const describeReadyInShort = (readyInHours: number): string =>
  readyInHours === 0 ? "ready now" : `ready in ${readyInHours} h`;

export type MuscleListRowCopy = {
  name: string;
  /** The heat as the row ends: "3 %". */
  heatText: string;
  /** The line under the name: "Rested · ready now", "Hot · ready in 19 h". */
  status: string;
  accessibleName: string;
};

/** The words of one row of the muscle list. */
export const describeMuscleListRow = ({
  muscle,
  heatPercent,
  heatStep,
  readyInHours,
}: MuscleListRow): MuscleListRowCopy => {
  const name = MUSCLE_NAMES[muscle];
  const stepName = describeHeatStep(heatStep);
  return {
    name,
    heatText: `${heatPercent} %`,
    status: `${stepName} · ${describeReadyInShort(readyInHours)}`,
    accessibleName: `${name}, heat ${heatPercent} percent, ${stepName.toLowerCase()}, ${describeReadyIn(readyInHours)}, open details`,
  };
};

export type TodayPlan =
  { kind: "session"; routineDayName: string; plannedSets: number } | { kind: "rest" };

export type DashboardBodyMapCardInput = Readonly<{
  /** `warmestMuscles` of the heat now, which is empty when nothing is warm. */
  warmest: readonly WarmMuscle[];
  /** Today's planned day, or null when there is no routine. */
  today: TodayPlan | null;
  heatWindowDays: number;
  /**
   * Whether the card opens the body map. Its name then ends with "Open the body map". A card that opens
   * nothing yet is named by what it shows alone.
   */
  opensBodyMap: boolean;
}>;

export type DashboardBodyMapCardCopy = {
  warmestLine: string;
  todayLine: string | null;
  /** The name of the whole card: what it shows, and "Open the body map" when it opens the body map. */
  accessibleName: string;
};

const warmestIn = (warmest: readonly WarmMuscle[], percentWord: string): string =>
  `Warmest: ${warmest
    .map(({ muscle, percent }) => `${MUSCLE_NAMES[muscle].toLowerCase()} ${percent} ${percentWord}`)
    .join(", ")}`;

/** The words of the body map card on the dashboard. */
export const describeDashboardBodyMapCard = ({
  warmest,
  today,
  heatWindowDays,
  opensBodyMap,
}: DashboardBodyMapCardInput): DashboardBodyMapCardCopy => {
  const nothingLogged = describeNothingLogged(heatWindowDays);
  const dayName = today?.kind === "session" ? today.routineDayName : BODY_MAP.dashboardCard.restDay;
  const todayLine = today === null ? null : `Today: ${dayName}`;
  const todaySpoken =
    today?.kind === "session"
      ? `${todayLine}, ${describeSets(today.plannedSets)} planned`
      : todayLine;
  const spoken = [
    `${BODY_MAP.title}, ${BODY_MAP.views.actual} heat now.`,
    `${warmest.length === 0 ? nothingLogged : warmestIn(warmest, "percent")}.`,
    ...(todaySpoken === null ? [] : [`${todaySpoken}.`]),
    ...(opensBodyMap ? [BODY_MAP.dashboardCard.open] : []),
  ];
  return {
    warmestLine: warmest.length === 0 ? nothingLogged : warmestIn(warmest, "%"),
    todayLine,
    accessibleName: spoken.join(" "),
  };
};

/** The Figure setting's row value in the settings list, under the row title "Figure": "Female". */
export const describeFigureRowValue = (figure: BodyArtworkFigure): string =>
  BODY_MAP.figureSetting.options[figure];

const TRUE_MINUS_SIGN = "\u2212";

export type WebListCaptionInput =
  | { scale: "heat"; moreAtRest: number }
  | { scale: "volume"; moreUnder: number; notTargeted: number }
  | { scale: "gap"; moreOnPlan: number; notInPlan: number };

const withCounts = (lead: string, counts: readonly (string | null)[]): string => {
  const parts = counts.filter((part) => part !== null);
  return parts.length === 0 ? lead : `${lead} · ${parts.join(", ")}`;
};

const countOf = (count: number, rest: string): string | null =>
  count === 0 ? null : `${count} ${rest}`;

/**
 * The caption over the web muscle list: what the list is sorted by, then how many muscles it leaves out.
 * A count of 0 is left out, and so is the dot when every count is 0.
 */
export const describeWebListCaption = (input: WebListCaptionInput): string => {
  if (input.scale === "heat") {
    return withCounts("Hottest first", [countOf(input.moreAtRest, "more at rest")]);
  }
  if (input.scale === "volume") {
    return withCounts("Most sets first", [
      countOf(input.moreUnder, "more under"),
      countOf(input.notTargeted, "not targeted"),
    ]);
  }
  return withCounts("Furthest behind first", [
    countOf(input.moreOnPlan, "more on plan"),
    countOf(input.notInPlan, "not in plan"),
  ]);
};

export type WebListRowCopy = {
  name: string;
  /** The figure the row ends with. */
  valueText: string;
  /** The word in the middle column. */
  status: string;
  accessibleName: string;
};

export type VolumeListRowInput = Readonly<{
  muscle: MuscleId;
  /** The week's sets: the projected ones in Projected, the logged ones in Actual. */
  weeklySets: number;
  status: VolumeStatus;
  view: BodyMapView;
  /** The Sunday that ends the week, `YYYY-MM-DD`, which Projected counts to. */
  weekEnd: string;
}>;

/** A row of the web muscle list on the volume scale. */
export const describeVolumeListRow = ({
  muscle,
  weeklySets,
  status,
  view,
  weekEnd,
}: VolumeListRowInput): WebListRowCopy => {
  const name = MUSCLE_NAMES[muscle];
  const when = view === "projected" ? `by ${describeWeekdayName(weekEnd)}` : "so far this week";
  return {
    name,
    valueText: formatSetCount(weeklySets),
    status: VOLUME_STATUS_NAMES[status],
    accessibleName: `${name}, ${describeSets(weeklySets)} ${when}, ${VOLUME_STATUS_NAMES[status].toLowerCase()}, open details`,
  };
};

export type GapListRowInput = Readonly<{
  muscle: MuscleId;
  /** Effort-weighted sets done this week. */
  done: number;
  /** Effort-weighted sets of the week's plan. */
  planned: number;
  status: Exclude<GapValue, "not_in_plan">;
}>;

const describeSignedSets = (gap: number): string => {
  const figure = formatSetCount(Math.abs(gap));
  if (Number(figure) === 0) {
    return "0";
  }
  return `${gap < 0 ? TRUE_MINUS_SIGN : "+"}${figure}`;
};

/** A row of the web muscle list on the gap scale. */
export const describeGapListRow = ({
  muscle,
  done,
  planned,
  status,
}: GapListRowInput): WebListRowCopy => {
  const name = MUSCLE_NAMES[muscle];
  return {
    name,
    valueText: describeSignedSets(done - planned),
    status: `${GAP_VALUE_NAMES[status]} · ${formatSetCount(done)} of ${describeSets(planned)}`,
    accessibleName: `${name}, ${formatSetCount(done)} of ${formatSetCount(planned)} planned ${setWord(planned)}, ${GAP_VALUE_NAMES[status].toLowerCase()}, open details`,
  };
};
