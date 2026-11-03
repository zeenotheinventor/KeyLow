import { BODY_MAP, describeHeatStep, describeShortDate, joinInWords } from "./bodyMap";
import { NO_TARGET_BANNER } from "./diary";
import { DAY_STEPPER } from "./diaryDay";
import { CALORIE_RING } from "./diaryRing";
import { UNDO_LABEL } from "./foodLog";
import { FOOD_ROW } from "./foodRow";
import { MUSCLE_NAMES } from "./muscleNames";
import { SET_ENTRY } from "./sessionEntry";
import { TRAIN_TODAY_CARD } from "./train";
import { WEIGHT_EMPTY } from "./weight";
import { formatCalories } from "../format/numbers";

import type { MuscleId } from "../training/muscles";

/*
 * The words of the phone widgets, as boards A, B and D of "Ki-Lo home screen widgets" draw them. The
 * sample numbers on the boards are not copy. Muscle names, heat steps, the Undo label and the no-target
 * banner are the app's own words, reused. Data in, sentence out: a widget shows every string as written.
 */

const upper = (text: string): string => text.toUpperCase();

const ENERGY = FOOD_ROW.energyUnit;

/** The labels of the widgets' buttons and the names a screen reader reads for them. */
export const WIDGET_ACTIONS = {
  openKiLo: "Open Ki-Lo",
  openTrain: "Open Train",
  openSession: "Open session",
  search: { label: "Search", name: "Search for a food" },
  scan: { label: "Scan", name: "Scan a barcode" },
  quickAdd: { label: FOOD_ROW.quickAdd, name: "Quick add calories" },
  weight: { label: "Weight", name: "Log weight" },
  logFood: { label: "Log food", name: "Search for a food" },
  recipe: { label: "Recipe", name: "Log a recipe" },
  logToday: "Log today",
  startSession: "Start session",
  emptySession: "Empty session",
  logSet: SET_ENTRY.logSetAction,
  setTarget: NO_TARGET_BANNER.action,
  undo: UNDO_LABEL,
} as const;

/** The states of board D, which every widget size words the same way. */
export const WIDGET_STATES = {
  signedOut: {
    eyebrow: "KI-LO",
    headline: "Sign in to see today",
    body: "Your nutrition and training appear here once you sign in.",
  },
  noData: {
    eyebrow: "TODAY",
    headline: "Open Ki-Lo to load today",
    body: "The widget fills in after the app has opened once today.",
  },
  noTarget: {
    eyebrow: "TODAY",
    headline: NO_TARGET_BANNER.title,
    body: NO_TARGET_BANNER.body,
  },
  restDay: {
    eyebrow: "TRAIN · TODAY",
    headline: TRAIN_TODAY_CARD.restTitle,
    body: "Nothing planned today. Recovery counts too.",
  },
  noRecentFoods: {
    eyebrow: "LOG AGAIN",
    headline: "Nothing logged yet",
    body: "Foods you log appear here, ready to log again.",
  },
  couldntLog: {
    headline: "Couldn't log that. Nothing was saved.",
    body: "Check your connection, or log it in Ki-Lo.",
  },
  sessionMovedOn: {
    eyebrow: "IN SESSION",
    headline: "Your session moved on",
    body: "The set on the widget no longer matches the app, so nothing was logged.",
  },
} as const;

/** The eyebrows that do not depend on a number. */
export const WIDGET_EYEBROWS = {
  today: "TODAY",
  heatNow: "HEAT NOW",
  logAgain: "LOG AGAIN",
  weight: "WEIGHT",
  trainToday: "TRAIN · TODAY",
  thisWeek: "THIS WEEK",
  trainingToday: "TRAINING TODAY",
} as const;

/** The eyebrow of a card that names its day: "TODAY · TUE 3 NOV". */
export const describeTodayEyebrow = (localDate: string): string =>
  upper(`Today · ${describeShortDate(localDate)}`);

/** The eyebrow of the large card: "KI-LO · TUE 3 NOV". */
export const describeGlanceEyebrow = (localDate: string): string =>
  upper(`Ki-Lo · ${describeShortDate(localDate)}`);

/** The eyebrow of the week card: "THIS WEEK · FROM MON 2 NOV". */
export const describeWeekEyebrow = (weekStart: string): string =>
  upper(`This week · from ${describeShortDate(weekStart)}`);

/** The eyebrow of the body map: "BODY MAP · HEAT". */
export const describeBodyMapEyebrow = (scale: "heat" | "volume"): string =>
  upper(`Body map · ${BODY_MAP.scaleSwitch[scale]}`);

/** The eyebrow of a running session: "IN SESSION · 32 MIN". */
export const describeSessionEyebrow = (minutes: number): string => `IN SESSION · ${minutes} MIN`;

/** The line under the ring's number: "kcal left", "kcal over", or "kcal eaten" when there is no target. */
export const describeRingCaption = (state: "left" | "over" | "eaten"): string =>
  state === "left"
    ? `${ENERGY} left`
    : state === "over"
      ? `${ENERGY} over`
      : `${ENERGY} ${CALORIE_RING.eaten}`;

/** Under the small ring: "1,460 of 2,200". */
export const describeEatenOfTarget = (eaten: number, target: number): string =>
  `${formatCalories(eaten)} of ${formatCalories(target)}`;

/** The ring's name, as the board labels it: "1,460 of 2,200 kcal eaten". */
export const describeRingName = (eaten: number, target: number): string =>
  `${describeEatenOfTarget(eaten, target)} ${ENERGY} ${CALORIE_RING.eaten}`;

/** The offline layout's line: "1,460 of 2,200 kcal". */
export const describeEatenOfTargetWithUnit = (eaten: number, target: number): string =>
  `${describeEatenOfTarget(eaten, target)} ${ENERGY}`;

/** The no-target state's corner: "1,460 kcal eaten". */
export const describeEatenWithoutTarget = (eaten: number): string =>
  `${formatCalories(eaten)} ${ENERGY} ${CALORIE_RING.eaten}`;

/** The week card's caption under the average: "kcal average · target 2,200", or "kcal average" with no target. */
export const describeAverageCaption = (target: number | null): string =>
  target === null ? `${ENERGY} average` : `${ENERGY} average · target ${formatCalories(target)}`;

/** The large card's week line: "2,050 kcal average". */
export const describeAverageLine = (average: number): string =>
  `${formatCalories(average)} ${ENERGY} average`;

/** The offline note: "Offline · updated 10:05". */
export const describeOfflineStatus = (clockTime: string): string =>
  `Offline · updated ${clockTime}`;

/** A food's energy on a Log again row: "410 kcal". */
export const describeFoodEnergy = (kcal: number): string => `${formatCalories(kcal)} ${ENERGY}`;

/** The name of a Log again row: "Log Overnight oats again, 410 kcal". */
export const describeLogAgainName = (name: string, kcal: number): string =>
  `Log ${name} again, ${describeFoodEnergy(kcal)}`;

/** What the row says after a one-tap log: "Logged Overnight oats", or "Logged" when the name is not known. */
export const describeLogged = (name: string | null): string =>
  name === null ? "Logged" : `Logged ${name}`;

/** The weight card's line under the number: "Logged today", "Logged yesterday", "Logged 3 days ago". */
export const describeWeighInAge = (daysAgo: number): string =>
  daysAgo <= 0
    ? `Logged ${DAY_STEPPER.today.toLowerCase()}`
    : daysAgo === 1
      ? `Logged ${DAY_STEPPER.yesterday.toLowerCase()}`
      : `Logged ${daysAgo} days ago`;

/** The weight card's number when nothing is logged yet. The boards do not draw it. */
export const WIDGET_NO_WEIGH_INS = WEIGHT_EMPTY.title;

/** The Training widget's line under the day: "5 exercises · Rows, Pull-ups, Curls and 2 more". */
export const describePlanSubtitle = (exerciseCount: number, names: readonly string[]): string => {
  const more = exerciseCount - names.length;
  const listed = more > 0 ? [...names, `${more} more`] : names;

  return `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"} · ${joinInWords(listed)}`;
};

/** The large card's training line: "Pull day · 5 exercises". */
export const describePlanLine = (dayName: string, exerciseCount: number): string =>
  `${dayName} · ${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`;

/** The large card's training line while a session runs: "Pull day · In progress". */
export const describeSessionLine = (dayName: string | null): string =>
  `${dayName ?? TRAIN_TODAY_CARD.sessionName} · ${TRAIN_TODAY_CARD.inProgressLabel}`;

/** The warmest muscle on the large card: "Upper chest peak". */
export const describeHeatChip = (muscle: MuscleId, heatStep: number): string =>
  `${MUSCLE_NAMES[muscle]} ${describeHeatStep(heatStep).toLowerCase()}`;

/** The session card's corner: "Exercise 2 of 5". */
export const describeExerciseProgress = (number: number, count: number): string =>
  `Exercise ${number} of ${count}`;

/** The session card's set: "Set 3 of 4". */
export const describeSetProgress = (number: number, count: number): string =>
  `Set ${number} of ${count}`;

/** The units beside a set's numbers. The load's unit is the person's weight unit. */
export const WIDGET_SET_WORDS = { reps: "reps", times: "×" } as const;

/** What the last session did: "Last time 67.5 × 8". A bodyweight set has no load: "Last time 8 reps". */
export const describeLastTime = (load: string | null, reps: number): string =>
  load === null ? `Last time ${reps} ${WIDGET_SET_WORDS.reps}` : `Last time ${load} × ${reps}`;
