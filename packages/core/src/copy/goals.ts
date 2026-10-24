import { describeShortDate, joinInWords } from "./bodyMap";
import { describeCount } from "./counts";
import { MUSCLE_NAMES, NAME_NUMBER } from "./muscleNames";
import { capitaliseFirst } from "./wording";
import {
  MAX_DAYS_PER_WEEK,
  MAX_SESSION_MINUTES,
  MIN_DAYS_PER_WEEK,
  MIN_SESSION_MINUTES,
} from "../training/bounds";
import { EQUIPMENT, TRAINING_FOCUSES } from "../training/enums";
import { GOAL_PRESETS_V1 } from "../training/goalPresets";
import { MUSCLE_GROUPS, MUSCLE_IDS, MUSCLES } from "../training/muscles";

import type { Equipment, ExperienceLevel, TrainingFocus, TrainingGoal } from "../training/enums";
import type { GoalAnswers } from "../training/goalAnswers";
import type { MuscleId } from "../training/muscles";
import type { PrioritySummary } from "../training/prioritySummary";

/*
 * The words of the goal questionnaire, the priorities summary and the goal screen (KEY-417), as the canvas
 * boards `goals · *` and `web-goals · questionnaire` draw them (version 30), except where a doc says no
 * board draws a sentence or the agreed document overrides one. Data in, sentence out: every count and muscle
 * in a sentence comes from the input. A goal answer is health data, so none of these throws with an answer
 * in its message, and the errors state the rule and never a value.
 *
 * The experience help line is the one Zee agreed in the KEY-396 document, Part 2 (the board's says
 * experience sets the sets a week, which it does not). The summary leaves out the board's reasons "That
 * keeps your waist narrow" and "They still work in your big lifts", which the agreed table does not back
 * (KEY-399 review). It words the board's "They build the V-taper, so suggestions fill them before anything
 * else." as "Suggestions fill them before anything else.", because the board's reason names V-taper and
 * the first group holds other muscles for other goals.
 */

/** The six questions, in the order the boards draw them. */
export const GOAL_QUESTION_STEPS = [
  "goal",
  "focus",
  "days",
  "minutes",
  "equipment",
  "experience",
] as const;

export type GoalQuestionStep = (typeof GOAL_QUESTION_STEPS)[number];

const STEP_COUNT = GOAL_QUESTION_STEPS.length;

/** The title, help line and note of each question. A question with no note has null. */
export const GOAL_QUESTIONS: Readonly<
  Record<GoalQuestionStep, Readonly<{ title: string; help: string; note: string | null }>>
> = {
  goal: {
    title: "What are you training for?",
    help: "This sets which muscles come first and how your sets and reps are planned.",
    note: null,
  },
  focus: {
    title: "Anything to focus on?",
    help: "Pick any that matter to you, or Overall.",
    note: null,
  },
  days: {
    title: "How many days a week?",
    help: "The days you can train in a normal week.",
    note: "Your routine keeps its own days. This only shapes suggestions.",
  },
  minutes: {
    title: "How long is a session?",
    help: "From arriving to leaving, warm-ups included.",
    note: `Other takes ${MIN_SESSION_MINUTES} to ${MAX_SESSION_MINUTES} minutes.`,
  },
  equipment: {
    title: "What can you use?",
    help: "Suggestions only use what you pick.",
    note: "Full gym picks everything but Other.",
  },
  experience: {
    title: "How long have you trained?",
    help: "This sets how many sets Ki-Lo suggests for each exercise it adds.",
    note: null,
  },
};

export type GoalOption = Readonly<{ label: string; description: string }>;

export const GOAL_OPTIONS: Readonly<Record<TrainingGoal, GoalOption>> = {
  aesthetic: { label: "Look better", description: "Build muscle where it shows, in proportion" },
  strength: {
    label: "Get stronger",
    description: "Lift more on the squat, bench, deadlift and overhead press",
  },
  hybrid: { label: "Both", description: "Strength on the big lifts, size everywhere else" },
};

export const FOCUS_OPTIONS: Readonly<Record<TrainingFocus, GoalOption>> = {
  v_taper: { label: "V-taper", description: "Wider shoulders and back, a narrower waist" },
  chest: { label: "Chest", description: "Upper and lower chest" },
  arms: { label: "Arms", description: "Biceps, triceps and forearms" },
  glutes: { label: "Glutes", description: "Glutes and side glutes" },
  legs: { label: "Legs", description: "Quads, hamstrings and calves" },
  overall: { label: "Overall", description: "No one area first" },
};

export const EXPERIENCE_OPTIONS: Readonly<Record<ExperienceLevel, GoalOption>> = {
  beginner: { label: "Beginner", description: "Under a year of steady training" },
  intermediate: { label: "Intermediate", description: "One to three years" },
  advanced: { label: "Advanced", description: "More than three years" },
};

/** The days a week the questionnaire offers, one chip each. */
export const DAYS_PER_WEEK_OPTIONS: readonly number[] = Array.from(
  { length: MAX_DAYS_PER_WEEK - MIN_DAYS_PER_WEEK + 1 },
  (_, offset) => MIN_DAYS_PER_WEEK + offset,
);

/** The session lengths the questionnaire offers before Other. */
export const MINUTES_PRESETS = [30, 45, 60, 75, 90] as const;

/** A session length chip: "60 min". */
export const describeMinutesOption = (minutes: number): string => `${minutes} min`;

/** The chip of each equipment value. */
export const EQUIPMENT_OPTIONS: Readonly<Record<Equipment, Readonly<{ label: string }>>> = {
  barbell: { label: "Barbell" },
  dumbbell: { label: "Dumbbell" },
  kettlebell: { label: "Kettlebell" },
  cable: { label: "Cable" },
  machine: { label: "Machine" },
  smith_machine: { label: "Smith machine" },
  ez_bar: { label: "EZ bar" },
  band: { label: "Band" },
  bodyweight: { label: "Bodyweight" },
  other: { label: "Other" },
};

/** The Full gym shortcut: one chip that picks every equipment value but Other. It is not a value of its own. */
export const FULL_GYM = {
  label: "Full gym",
  equipment: EQUIPMENT.filter((equipment) => equipment !== "other"),
} as const;

/** The fixed words around the six questions. */
export const GOAL_QUESTIONNAIRE = {
  backAction: "Back",
  nextAction: "Next",
  /** The Next button on the last question. */
  finalAction: "See your priorities",
  /** The web board's Cancel. */
  cancelAction: "Cancel",
  /** The name of the close button, which is also the warning that closing loses the answers. */
  closeLabel: "Close, your answers are not saved",
  closeConfirmation: "Your answers are not saved",
  /** The name of the progress bar. */
  progressName: "Questions answered",
  otherMinutesOption: "Other",
} as const;

/** The text with its first letter in capitals. */

/** The fixed words of the errors. They state the rule and never a value. */
export const GOAL_ERRORS = {
  minutes: `Enter minutes from ${MIN_SESSION_MINUTES} to ${MAX_SESSION_MINUTES}.`,
  /** No board draws this line. */
  save: "Your goal did not save. Check your connection, then try again.",
} as const;

const assertStep = (step: number): void => {
  if (!Number.isInteger(step) || step < 1 || step > STEP_COUNT) {
    throw new RangeError(`A question step must be a whole number from 1 to ${STEP_COUNT}`);
  }
};

/** The step label above the progress bar: "Your goal · 1 of 6". */
export const describeQuestionStep = (step: number): string => {
  assertStep(step);
  return `Your goal · ${step} of ${STEP_COUNT}`;
};

/** The step for a screen reader: "Question 1 of 6". No board draws this line. */
export const describeQuestionStepName = (step: number): string => {
  assertStep(step);
  return `Question ${step} of ${STEP_COUNT}`;
};

/** The name of an option card for a screen reader: its label, then its description. No board draws this line. */
export const describeOptionName = ({ label, description }: GoalOption): string =>
  `${label}. ${description}`;

/*
 * The answers as a phrase inside a sentence. Written out and not derived from the labels, because two of
 * them keep a capital ("V-taper", "EZ bar", "Smith machine") and the goal "Both" needs words.
 */
const GOAL_PHRASES: Readonly<Record<TrainingGoal, string>> = {
  aesthetic: "look better",
  strength: "get stronger",
  hybrid: "look better and get stronger",
};

const FOCUS_PHRASES: Readonly<Record<TrainingFocus, string>> = {
  v_taper: "V-taper",
  chest: "chest",
  arms: "arms",
  glutes: "glutes",
  legs: "legs",
  overall: "overall focus",
};

const EQUIPMENT_PHRASES: Readonly<Record<Equipment, string>> = {
  barbell: "barbell",
  dumbbell: "dumbbell",
  kettlebell: "kettlebell",
  cable: "cable",
  machine: "machine",
  smith_machine: "Smith machine",
  ez_bar: "EZ bar",
  band: "band",
  bodyweight: "bodyweight",
  other: "other equipment",
};

const isFullGym = (equipment: GoalAnswers["equipment"]): boolean =>
  !equipment.includes("other") && FULL_GYM.equipment.every((value) => equipment.includes(value));

/** The values that were chosen, in the order of the list, whatever order they were chosen in. */
const inListOrder = <Value extends string>(
  list: readonly Value[],
  chosen: readonly Value[],
): Value[] => list.filter((value) => chosen.includes(value));

const describeFocusPhrase = (focus: GoalAnswers["focus"]): string =>
  joinInWords(inListOrder(TRAINING_FOCUSES, focus).map((value) => FOCUS_PHRASES[value]));

const describeEquipmentPhrase = (equipment: GoalAnswers["equipment"]): string => {
  if (isFullGym(equipment)) {
    return FULL_GYM.label.toLowerCase();
  }
  return equipment.length === 0
    ? "no equipment"
    : joinInWords(inListOrder(EQUIPMENT, equipment).map((value) => EQUIPMENT_PHRASES[value]));
};

const describeDaysPhrase = (days: number): string => `${describeCount(days, "day", "days")} a week`;

const describeMinutesPhrase = (minutes: number): string =>
  describeCount(minutes, "minute", "minutes");

/**
 * The answers restated above the priorities: "From your answers: look better, V-taper, 4 days a week,
 * 60 minutes, full gym, intermediate." A strength user with no focus has no focus item.
 */
export const describeGoalAnswersSentence = (answers: GoalAnswers): string => {
  const items = [
    GOAL_PHRASES[answers.goal],
    ...(answers.focus.length === 0 ? [] : [describeFocusPhrase(answers.focus)]),
    describeDaysPhrase(answers.days_per_week),
    describeMinutesPhrase(answers.session_minutes),
    describeEquipmentPhrase(answers.equipment),
    EXPERIENCE_OPTIONS[answers.experience].label.toLowerCase(),
  ];
  return `From your answers: ${items.join(", ")}.`;
};

/*
 * The order the summary names muscles in: the shoulders, back and chest first, as the board writes the
 * V-taper line ("Side delts, lats and upper chest"), then the arms, core, legs and neck. Inside a group the
 * order is the muscle list's. The muscle list alone would put upper chest first.
 */
export const SENTENCE_GROUP_ORDER = [
  "shoulders",
  "back",
  "chest",
  "arms",
  "core",
  "legs",
  "neck",
] as const satisfies readonly (typeof MUSCLE_GROUPS)[number][];

const sentencePosition = (muscle: MuscleId): number =>
  SENTENCE_GROUP_ORDER.indexOf(MUSCLES[muscle].group) * MUSCLE_IDS.length +
  MUSCLE_IDS.indexOf(muscle);

/** Muscle names as a sentence subject: "Side delts, lats and upper chest". */
const describeMuscleSubject = (muscles: readonly MuscleId[]): string =>
  capitaliseFirst(
    joinInWords(
      [...muscles]
        .sort((first, second) => sentencePosition(first) - sentencePosition(second))
        .map((muscle) => MUSCLE_NAMES[muscle].toLowerCase()),
    ),
  );

/** "come" for several muscles, or for one whose name reads as many ("lats"), and "comes" for "neck". */
const agree = (muscles: readonly MuscleId[], plural: string, singular: string): string =>
  muscles.length === 1 && muscles[0] !== undefined && NAME_NUMBER[muscles[0]] === "one"
    ? singular
    : plural;

export type PriorityRowGroup = "first" | "keptUp" | "notTargeted" | "fit";

export type PriorityRow = Readonly<{
  group: PriorityRowGroup;
  title: string;
  detail: string | null;
}>;

export type PrioritiesCopy = Readonly<{
  answers: string;
  rows: readonly PriorityRow[];
  legend: string;
}>;

/** The line under the body map of the summary. */
const PRIORITIES_LEGEND =
  "Green muscles come first. Grey ones are not targeted, so they never read as under.";

/**
 * The words of "Your priorities" from KEY-399's groups: the answers line, one row for each group that has
 * muscles in it (first, kept up, not targeted), the row that restates the days, minutes and equipment, and
 * the legend. The sets for each exercise Ki-Lo adds come from the goal presets v1 for the user's
 * experience, so the sentence never states a number of its own.
 */
export const describePriorities = (summary: PrioritySummary): PrioritiesCopy => {
  const { first, keptUp, notTargeted, answers } = summary;
  const setsPerExercise = GOAL_PRESETS_V1.setsPerExercise[answers.experience];
  const rows: PriorityRow[] = [
    ...(first.length === 0
      ? []
      : [
          {
            group: "first",
            title: `${describeMuscleSubject(first)} ${agree(first, "come", "comes")} first`,
            detail: "Suggestions fill them before anything else.",
          } satisfies PriorityRow,
        ]),
    ...(keptUp.length === 0
      ? []
      : [
          {
            group: "keptUp",
            title: "Everything else in your routine is kept up",
            detail: `Exercises Ki-Lo adds get ${describeCount(setsPerExercise, "set", "sets")} each, from your experience.`,
          } satisfies PriorityRow,
        ]),
    ...(notTargeted.length === 0
      ? []
      : [
          {
            group: "notTargeted",
            title: `${describeMuscleSubject(notTargeted)} ${agree(notTargeted, "get", "gets")} no direct work`,
            detail: null,
          } satisfies PriorityRow,
        ]),
    {
      group: "fit",
      title: `${describeDaysPhrase(answers.days_per_week)}, about ${describeMinutesPhrase(answers.session_minutes)}, ${describeEquipmentPhrase(answers.equipment)}`,
      detail: "Suggestions fit inside these and keep your routine as it is.",
    },
  ];
  return { answers: describeGoalAnswersSentence(answers), rows, legend: PRIORITIES_LEGEND };
};

/** The fixed words of the priorities summary screen. */
export const GOAL_SUMMARY = {
  title: "Your priorities",
  backLabel: "Back to the questions",
  saveAction: "Save goal",
  /** The name of the card of priority rows. */
  prioritiesSectionName: "Priorities",
  bodyMapFrontName: "Your priorities on the body map, front",
  bodyMapBackName: "Your priorities on the body map, back",
} as const;

/** The fixed words of the goal screen. */
export const GOAL_SCREEN = {
  title: "Goal",
  backLabel: "Back to Train",
  changeNote:
    "Changing an answer starts your new goal from today. Suggestions you already took keep their reasons.",
  prioritiesAction: "See your priorities",
} as const;

/** The label of each answer row on the goal screen. */
export const GOAL_ANSWER_ROWS: Readonly<Record<GoalQuestionStep, string>> = {
  goal: "Goal",
  focus: "Focus",
  days: "Days a week",
  minutes: "Session",
  equipment: "Equipment",
  experience: "Experience",
};

export type GoalAnswerRow = Readonly<{
  step: GoalQuestionStep;
  label: string;
  value: string;
  /** The name for a screen reader: "Goal: Look better. Change". */
  name: string;
}>;

/** What a row shows when the answer is an empty list. No board draws this word. */
const NO_ANSWER = "None";

/** The six answer rows of the goal screen, in the order of the questions, each with its name for a screen reader. */
export const describeGoalAnswerRows = (answers: GoalAnswers): readonly GoalAnswerRow[] => {
  const values: Readonly<Record<GoalQuestionStep, string>> = {
    goal: GOAL_OPTIONS[answers.goal].label,
    focus:
      answers.focus.length === 0 ? NO_ANSWER : capitaliseFirst(describeFocusPhrase(answers.focus)),
    days: String(answers.days_per_week),
    minutes: describeMinutesPhrase(answers.session_minutes),
    equipment: isFullGym(answers.equipment)
      ? FULL_GYM.label
      : answers.equipment.length === 0
        ? NO_ANSWER
        : capitaliseFirst(describeEquipmentPhrase(answers.equipment)),
    experience: EXPERIENCE_OPTIONS[answers.experience].label,
  };
  return GOAL_QUESTION_STEPS.map((step) => ({
    step,
    label: GOAL_ANSWER_ROWS[step],
    value: values[step],
    name: `${GOAL_ANSWER_ROWS[step]}: ${values[step]}. Change`,
  }));
};

/** When the goal was set, from its calendar day (`YYYY-MM-DD`): "Set on Mon 21 Sep". */
export const describeGoalSetOn = (localDate: string): string =>
  `Set on ${describeShortDate(localDate)}`;
