import {
  describeHeatStep,
  describeSets,
  describeWeekdayName,
  formatSetCount,
  joinInWords,
} from "./bodyMap";
import { describeCount } from "./counts";
import { describeDateInWords } from "./diary";
import { MUSCLE_NAMES, NAME_NUMBER } from "./muscleNames";
import { GOAL_PRESETS_V1 } from "../training/goalPresets";
import { heatPercentOf, heatStepOf } from "../training/heatReadout";
import { muscleParams } from "../training/muscleState";
import { TRAINING_PARAMS_V1 } from "../training/params";

import type { TrainingFocus, TrainingGoal } from "../training/enums";
import type { MuscleId } from "../training/muscles";
import type {
  NoRoom,
  NothingToSuggest,
  PlanAdjusted,
  PlanDayExercise,
  SuggestedExercise,
  SuggestedSession,
  SuggestionReason,
} from "../training/suggest/suggestTypes";

/*
 * The words of the suggestion card, its detail, the accepted card and toast, and the nothing-to-add card
 * (KEY-418), as the canvas boards `suggestion · *` draw them (version 30, redrawn for the incline press Zee
 * agreed on KEY-396). Suggestions are code, not model output: every number in a sentence comes from the
 * suggestion, and a name comes from the library or the routine the caller passes in. There are no swaps in
 * v1, so no sentence speaks of one. A suggestion is health data, so none of these throws with a name or
 * a number in its message.
 *
 * A board draws a suggestion for tomorrow. For today the primary button reads "Start" and the day reads
 * "today". The boards do not draw today, the other reasons for nothing, a session with no plan to add to, the
 * second and later picks, the reason lines of the other muscles of an exercise, or the card for a user with
 * no goal. Each of those sentences is written here and listed on the pull request for Zee to confirm.
 */

/** A suggestion that holds exercises, as opposed to `nothing`. */
export type SuggestedDay = PlanAdjusted | SuggestedSession;

/** The goal answers the sentences read: the goal and focus say why a muscle is a priority. */
export type SuggestionGoals = Readonly<{
  goal: TrainingGoal;
  focus: readonly TrainingFocus[];
  /** The minutes the suggestion was made with. */
  limit_minutes: number;
}>;

export type SuggestionContext = Readonly<{
  /** The day the suggestion is for, `YYYY-MM-DD`. */
  localDate: string;
  /** Today in the user's zone, `YYYY-MM-DD`: the day reads "today" when it is the same. */
  todayLocalDate: string;
  /** The routine day the suggestion adds to ("Legs"), or null for a fresh session. */
  routineDayName: string | null;
  /** The name of each exercise the suggestion holds, as the library stores it, by exercise id. */
  exerciseNames: ReadonlyMap<string, string>;
  goals: SuggestionGoals;
}>;

export type SuggestionRepRange = Readonly<{ repMin: number; repMax: number }>;

export type SuggestionDetailContext = SuggestionContext &
  Readonly<{
    /** The rep range of each planned exercise the suggestion kept, by its routine exercise id. */
    plannedRepRanges: ReadonlyMap<string, SuggestionRepRange>;
  }>;

/** The fixed words of the suggestion card. */
export const SUGGESTION_CARD = {
  /** The primary button when the suggestion is for today. */
  startAction: "Start",
  dismissAction: "Not now",
} as const;

/** The fixed words of the suggestion detail. */
export const SUGGESTION_DETAIL = {
  backLabel: "Back to Train",
  footnoteWithPlan:
    "Ki-Lo keeps your plan and adds what your week is short of. Muscles still hot are left out.",
  footnoteWithoutPlan:
    "Ki-Lo builds this from what your week is short of. Muscles still hot are left out.",
} as const;

/** The fixed words of the accepted card and its toast. */
export const SUGGESTION_ACCEPTED = {
  undoAction: "Undo",
} as const;

/** The card for a user with no goal. No board draws it. */
export const SUGGESTION_NO_GOAL = {
  sectionName: "Suggestions",
  title: "Set your goal",
  body: "Tell Ki-Lo what you are training for and it suggests your next session.",
  action: "Set your goal",
} as const;

const capitaliseFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

const isToday = ({ localDate, todayLocalDate }: SuggestionContext): boolean =>
  localDate === todayLocalDate;

/** The day as a sentence says it: "Thursday", or "today". */
const describeDay = (context: SuggestionContext): string =>
  isToday(context) ? "today" : describeWeekdayName(context.localDate);

const describeRoutineDay = ({ routineDayName }: SuggestionContext): string =>
  routineDayName ?? "session";

const exerciseNameOf = (exerciseId: string, context: SuggestionContext): string => {
  const name = context.exerciseNames.get(exerciseId);
  if (name === undefined) {
    throw new RangeError("A suggested exercise must have a name");
  }
  return name;
};

/*
 * Words of the curated library that are names or places and keep their capital inside a sentence. Any other
 * word of one capital and lowercase letters is lowercased: "Barbell Squat" reads "barbell squat". Words with
 * two or more capitals (EZ, JM, DB) and a single capital before a hyphen (T-Bar) are left alone.
 */
export const EXERCISE_PROPER_WORDS: ReadonlySet<string> = new Set([
  "Arnold",
  "Atlas",
  "Bosu",
  "Bradford",
  "Conan",
  "Cuban",
  "Frankenstein",
  "Gironda",
  "Janda",
  "Jefferson",
  "Judo",
  "London",
  "Olympic",
  "Otis",
  "Pallof",
  "Rocky",
  "Romanian",
  "Russian",
  "Smith",
  "Svend",
  "Tate",
  "Turkish",
  "Zercher",
  "Zottman",
]);

/** An exercise inside a sentence: "incline dumbbell press". */
const describeExerciseInSentence = (exerciseId: string, context: SuggestionContext): string =>
  exerciseNameOf(exerciseId, context).replace(/(?<![A-Z]-)\b[A-Z][a-z]+\b/g, (word) =>
    EXERCISE_PROPER_WORDS.has(word) ? word : word.toLowerCase(),
  );

/** An exercise as a row title: "Incline dumbbell press". */
const describeExerciseTitle = (exerciseId: string, context: SuggestionContext): string =>
  capitaliseFirst(describeExerciseInSentence(exerciseId, context));

const isAdded = (exercise: PlanDayExercise): exercise is SuggestedExercise =>
  exercise.origin === "added";

const addedOf = (suggestion: SuggestedDay): readonly SuggestedExercise[] => {
  const exercises: readonly PlanDayExercise[] = suggestion.exercises;
  return exercises.filter(isAdded);
};

/** What was added, as a list: "3 sets of incline dumbbell press and 3 sets of side lateral raise". */
const describeAdded = (added: readonly SuggestedExercise[], context: SuggestionContext): string =>
  joinInWords(
    added.map(
      ({ sets, exercise_id }) =>
        `${describeCount(sets, "set", "sets")} of ${describeExerciseInSentence(exercise_id, context)}`,
    ),
  );

// The focus words of `goals.ts` (`FOCUS_PHRASES`), with the article the sentence needs.
const FOCUS_PRIORITY_PHRASES: Readonly<Record<TrainingFocus, string>> = {
  v_taper: "a V-taper priority",
  chest: "a chest priority",
  arms: "an arms priority",
  glutes: "a glutes priority",
  legs: "a legs priority",
  overall: "an overall priority",
};

/** The focus that raised the muscle to this priority, when the goal's own base did not give it. */
const raisingFocusOf = (
  { muscle_id, priority }: SuggestionReason,
  { goal, focus }: SuggestionGoals,
): TrainingFocus | undefined =>
  focus.find(
    (each) =>
      (GOAL_PRESETS_V1.focusPriority[each][muscle_id] ?? 0) === priority &&
      GOAL_PRESETS_V1.basePriority[goal][muscle_id] < priority,
  );

/** Why the muscle is a priority: the focus that raised it, or how high the goal ranks it. */
const describePriority = (reason: SuggestionReason, goals: SuggestionGoals): string => {
  const focus = raisingFocusOf(reason, goals);
  if (focus !== undefined) {
    return FOCUS_PRIORITY_PHRASES[focus];
  }
  if (reason.priority >= 3) {
    return "a top priority";
  }
  return reason.priority >= 2 ? "an important priority" : "a priority to keep up";
};

/*
 * The sets of "in the last 7 days" are `logged_sets`. `weekly_sets` also counts the planned exercises kept
 * and the picks before it, so no sentence calls it a count of what was logged.
 */
const IN_THE_LAST_7_DAYS = "in the last 7 days";

const isOrAre = (muscles: readonly MuscleId[]): string => {
  const [only] = muscles;
  return muscles.length === 1 && only !== undefined && NAME_NUMBER[only] === "one" ? "is" : "are";
};

export type SuggestionReasonLine = Readonly<{
  kind: "volume" | "heat" | "length";
  text: string;
}>;

/** "Upper chest: 4.8 sets in the last 7 days, target 12, a V-taper priority". */
const describeVolumeLine = (
  reason: SuggestionReason,
  goals: SuggestionGoals,
): SuggestionReasonLine => ({
  kind: "volume",
  text: `${MUSCLE_NAMES[reason.muscle_id]}: ${describeSets(reason.logged_sets)} ${IN_THE_LAST_7_DAYS}, target ${formatSetCount(reason.mav_low)}, ${describePriority(reason, goals)}`,
});

const describeHeatPercent = (heat: number): string => `heat ${heatPercentOf(heat)} %`;

const describeHeat = (heat: number): string =>
  `${describeHeatPercent(heat)}, ${describeHeatStep(heatStepOf(heatPercentOf(heat))).toLowerCase()}`;

/** Whether the muscle is ready: its heat is at or below the ready share of its capacity, 0.25 in v1. */
const isReady = ({ muscle_id, heat }: SuggestionReason): boolean => {
  const { threshold, capacity } = muscleParams(muscle_id, TRAINING_PARAMS_V1);
  return heat <= threshold / capacity;
};

/** "Upper chest is ready now: heat 13 %, light", or without the claim above the ready share: "Upper chest: heat 35 %, warm". */
const describeHeatLine = (reason: SuggestionReason): SuggestionReasonLine => ({
  kind: "heat",
  text: isReady(reason)
    ? `${MUSCLE_NAMES[reason.muscle_id]} ${isOrAre([reason.muscle_id])} ready now: ${describeHeat(reason.heat)}`
    : `${MUSCLE_NAMES[reason.muscle_id]}: ${describeHeat(reason.heat)}`,
});

/** A day with a plan has at most two additions, all named. A fresh session names its first pick only. */
const picksOnCard = (suggestion: SuggestedDay): readonly SuggestedExercise[] =>
  suggestion.kind === "plan_adjusted" ? addedOf(suggestion) : addedOf(suggestion).slice(0, 1);

const describeCardReasons = (
  added: readonly SuggestedExercise[],
  goals: SuggestionGoals,
): SuggestionReasonLine[] =>
  added.flatMap(({ reasons }, position) => {
    const [lead] = reasons;
    if (lead === undefined) {
      return [];
    }
    return position === 0
      ? [describeVolumeLine(lead, goals), describeHeatLine(lead)]
      : [describeVolumeLine(lead, goals)];
  });

const describeLengthLine = (
  suggestion: SuggestedDay,
  context: SuggestionContext,
): SuggestionReasonLine[] =>
  suggestion.kind === "plan_adjusted"
    ? [
        {
          kind: "length",
          text: `${capitaliseFirst(describeDay(context))} goes from ${suggestion.planned.sets} to ${suggestion.sets} sets, about ${suggestion.minutes} minutes`,
        },
      ]
    : [];

const FRESH_HEADLINE = "A session built for your week";

/** "Legs, plus incline dumbbell press", or the fresh session's own headline. */
const describeHeadline = (suggestion: SuggestedDay, context: SuggestionContext): string =>
  suggestion.kind === "plan_adjusted"
    ? `${capitaliseFirst(describeRoutineDay(context))}, plus ${joinInWords(
        addedOf(suggestion).map(({ exercise_id }) =>
          describeExerciseInSentence(exercise_id, context),
        ),
      )}`
    : FRESH_HEADLINE;

const describeStartName = (suggestion: SuggestedDay, context: SuggestionContext): string =>
  suggestion.kind === "plan_adjusted"
    ? `Start ${describeRoutineDay(context)} with the added ${addedOf(suggestion).length === 1 ? "exercise" : "exercises"}`
    : "Start the suggested session";

/** The two buttons and their names, for the card and for the detail. */
type SuggestionActions = Readonly<{
  primaryAction: string;
  primaryActionName: string;
  dismissAction: string;
  dismissActionName: string;
}>;

const describeActions = (
  suggestion: SuggestedDay,
  context: SuggestionContext,
): SuggestionActions => {
  const day = describeDay(context);
  const primaryAction = isToday(context) ? SUGGESTION_CARD.startAction : `Add to ${day}`;
  return {
    primaryAction,
    primaryActionName: isToday(context) ? describeStartName(suggestion, context) : primaryAction,
    dismissAction: SUGGESTION_CARD.dismissAction,
    dismissActionName: `${SUGGESTION_CARD.dismissAction} for ${day}'s suggestion`,
  };
};

export type SuggestionCardCopy = SuggestionActions &
  Readonly<{
    /** The name of the card. */
    cardName: string;
    /** "Suggested for Thursday". */
    label: string;
    headline: string;
    /** The name of the link to the detail. */
    linkName: string;
    sentence: string;
    reasonsName: string;
    reasons: readonly SuggestionReasonLine[];
  }>;

const describeCardSentence = (suggestion: SuggestedDay, context: SuggestionContext): string =>
  suggestion.kind === "plan_adjusted"
    ? `Add ${describeAdded(addedOf(suggestion), context)} to the end of ${describeDay(context)}'s ${describeRoutineDay(context)}.`
    : `A session of ${describeCount(suggestion.exercises.length, "exercise", "exercises")} and ${describeCount(suggestion.sets, "set", "sets")}, about ${suggestion.minutes} min.`;

/**
 * The words of the suggestion card: the label, the headline, the sentence and the reasons (volume and heat
 * of the first pick, the volume of any later pick, and the day's new length), the two buttons, and the
 * names for a screen reader. A suggestion for today starts a session, so its button reads "Start".
 */
export const describeSuggestionCard = (
  suggestion: SuggestedDay,
  context: SuggestionContext,
): SuggestionCardCopy => {
  const day = describeDay(context);
  const headline = describeHeadline(suggestion, context);
  const label = `Suggested for ${day}`;
  return {
    cardName: `Suggestion for ${day}`,
    label,
    headline,
    linkName: `${label}: ${headline}. See why`,
    sentence: describeCardSentence(suggestion, context),
    reasonsName: `Why Ki-Lo suggests this for ${day}`,
    reasons: [
      ...describeCardReasons(picksOnCard(suggestion), context.goals),
      ...describeLengthLine(suggestion, context),
    ],
    ...describeActions(suggestion, context),
  };
};

export type SuggestionDetailRow = Readonly<{
  name: string;
  /** "3 × 8 to 10 · RIR 2". */
  target: string;
  /** "From your plan", or why the exercise was added. */
  why: string;
  added: boolean;
}>;

export type SuggestionDetailCopy = SuggestionActions &
  Readonly<{
    title: string;
    backLabel: string;
    /** "Thursday 15 October · your planned Legs". */
    dayLine: string;
    headline: string;
    /** "6 exercises · 19 sets · about 60 min". */
    loadLine: string;
    listName: string;
    rows: readonly SuggestionDetailRow[];
    footnote: string;
  }>;

const describeRepRange = ({ repMin, repMax }: SuggestionRepRange): string =>
  repMin === repMax ? String(repMin) : `${repMin} to ${repMax}`;

const describeTarget = (sets: number, reps: SuggestionRepRange, rir: number | null): string =>
  `${sets} × ${describeRepRange(reps)}${rir === null ? "" : ` · RIR ${rir}`}`;

/** "Glutes and hamstrings are short of target too.", for the other primary muscles of an exercise. */
const describeOtherReasons = (others: readonly SuggestionReason[]): string[] => {
  if (others.length === 0) {
    return [];
  }
  const muscles = others.map(({ muscle_id }) => muscle_id);
  const names = joinInWords(muscles.map((muscle) => MUSCLE_NAMES[muscle].toLowerCase()));
  return [`${capitaliseFirst(names)} ${isOrAre(muscles)} short of target too.`];
};

const describeNoRoom = ({ muscle_id }: NoRoom, goals: SuggestionGoals): string =>
  `${MUSCLE_NAMES[muscle_id]} would not fit your ${goals.limit_minutes} minutes.`;

/** Why an exercise was added: "Added. Upper chest is a V-taper priority, at 4.8 of 12 sets in the last 7 days, and ready now at heat 13 %." */
const describeAddedWhy = (
  { reasons }: SuggestedExercise,
  goals: SuggestionGoals,
  noRoom: NoRoom | null,
): string => {
  const [lead, ...others] = reasons;
  const leadSentence =
    lead === undefined
      ? []
      : [
          `${MUSCLE_NAMES[lead.muscle_id]} ${isOrAre([lead.muscle_id])} ${describePriority(lead, goals)}, at ${formatSetCount(lead.logged_sets)} of ${formatSetCount(lead.mav_low)} sets ${IN_THE_LAST_7_DAYS}, and ${isReady(lead) ? "ready now at" : "at"} ${describeHeatPercent(lead.heat)}.`,
        ];
  return [
    "Added.",
    ...leadSentence,
    ...describeOtherReasons(others),
    ...(noRoom === null ? [] : [describeNoRoom(noRoom, goals)]),
  ].join(" ");
};

const describeDetailRows = (
  suggestion: SuggestedDay,
  context: SuggestionDetailContext,
): SuggestionDetailRow[] => {
  const exercises: readonly PlanDayExercise[] = suggestion.exercises;
  const lastAddedPosition = exercises.map(isAdded).lastIndexOf(true);
  return exercises.map((exercise, position) => {
    const name = describeExerciseTitle(exercise.exercise_id, context);
    if (exercise.origin === "plan") {
      const reps = context.plannedRepRanges.get(exercise.routine_exercise_id);
      if (reps === undefined) {
        throw new RangeError("A planned exercise must have a rep range");
      }
      return {
        name,
        target: describeTarget(exercise.sets, reps, exercise.target_rir),
        why: "From your plan",
        added: false,
      };
    }
    return {
      name,
      target: describeTarget(
        exercise.sets,
        { repMin: exercise.rep_min, repMax: exercise.rep_max },
        exercise.target_rir,
      ),
      why: describeAddedWhy(
        exercise,
        context.goals,
        position === lastAddedPosition ? suggestion.no_room : null,
      ),
      added: true,
    };
  });
};

/**
 * The words of the suggestion detail: the day and its planned routine day, the headline, the length, a row
 * for each exercise with its target and where it came from, and the footnote. A planned exercise keeps its
 * rep range from the routine, which the suggestion does not carry, so the caller passes it by routine
 * exercise id. A muscle that did not fit is named on the last exercise added.
 */
export const describeSuggestionDetail = (
  suggestion: SuggestedDay,
  context: SuggestionDetailContext,
): SuggestionDetailCopy => {
  const day = describeDay(context);
  const hasPlan = suggestion.kind === "plan_adjusted";
  return {
    title: `Suggested for ${day}`,
    backLabel: SUGGESTION_DETAIL.backLabel,
    dayLine: `${describeDateInWords(context.localDate)} · ${hasPlan ? `your planned ${describeRoutineDay(context)}` : "built for your week"}`,
    headline: describeHeadline(suggestion, context),
    loadLine: `${describeCount(suggestion.exercises.length, "exercise", "exercises")} · ${describeCount(suggestion.sets, "set", "sets")} · about ${suggestion.minutes} min`,
    listName: `Exercises for ${day}`,
    rows: describeDetailRows(suggestion, context),
    footnote: hasPlan ? SUGGESTION_DETAIL.footnoteWithPlan : SUGGESTION_DETAIL.footnoteWithoutPlan,
    ...describeActions(suggestion, context),
  };
};

export type SuggestionAcceptedCopy = Readonly<{
  /** The name of the card that replaces the suggestion. */
  cardName: string;
  /** "Thursday's Legs: 19 sets". */
  title: string;
  detail: string;
  toast: string;
  undoAction: string;
  undoActionName: string;
}>;

/** The words of the card and the toast once the suggestion is added to the day. */
export const describeSuggestionAccepted = (
  suggestion: PlanAdjusted,
  context: SuggestionContext,
): SuggestionAcceptedCopy => {
  const day = describeDay(context);
  const added = describeAdded(addedOf(suggestion), context);
  return {
    cardName: capitaliseFirst(day),
    title: `${capitaliseFirst(day)}'s ${describeRoutineDay(context)}: ${describeCount(suggestion.sets, "set", "sets")}`,
    detail: `Now with ${added}. They count as planned.`,
    toast: `Added to ${day}: ${added}`,
    undoAction: SUGGESTION_ACCEPTED.undoAction,
    undoActionName: `${SUGGESTION_ACCEPTED.undoAction} adding to ${day}`,
  };
};

export type NothingToSuggestCopy = Readonly<{
  cardName: string;
  title: string;
  body: string;
}>;

const TRAIN_AS_PLANNED = "Train as planned.";

const describeNothingReason = (
  suggestion: NothingToSuggest,
  context: SuggestionContext,
): string => {
  switch (suggestion.why) {
    case "priorities_covered":
      return context.routineDayName === null
        ? "Your training already covers your priorities."
        : "Your plan already covers your priorities.";
    case "no_room":
      return `Adding ${MUSCLE_NAMES[suggestion.no_room.muscle_id].toLowerCase()} work would take ${describeDay(context)} to about ${suggestion.no_room.minutes_if_added} min, over your ${context.goals.limit_minutes} minutes.`;
    case "all_hot":
      return suggestion.skipped.length === 0
        ? "Every exercise for the muscles your week is short of works a muscle that is still hot."
        : `The muscles your week is short of are still hot: ${joinInWords(suggestion.skipped.map(({ muscle_id }) => MUSCLE_NAMES[muscle_id].toLowerCase()))}.`;
    case "no_exercise":
      return "Ki-Lo has no exercise for the muscles your week is short of with the equipment you picked.";
  }
};

/**
 * The words of the card that says there is nothing to add, for each of its four reasons. The closing
 * "Train as planned." is left out when the day has no plan.
 */
export const describeNothingToSuggest = (
  suggestion: NothingToSuggest,
  context: SuggestionContext,
): NothingToSuggestCopy => {
  const day = describeDay(context);
  return {
    cardName: `Suggestion for ${day}`,
    title: `${context.routineDayName === null ? "Nothing to suggest for" : "Nothing to add for"} ${day}`,
    body: [
      describeNothingReason(suggestion, context),
      ...(context.routineDayName === null ? [] : [TRAIN_AS_PLANNED]),
    ].join(" "),
  };
};
