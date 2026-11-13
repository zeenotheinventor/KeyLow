import {
  buildGoalsUpdatedCard,
  buildRoutineActiveCard,
  buildRoutineArchivedCard,
  buildRoutineCreatedCard,
  buildRoutineUpdatedCard,
  buildSetUpdatedCard,
  buildWorkoutDeletedCard,
  describeAssistantCard,
  withActionIds,
} from "@keylow/core";
import { Archive, Check, RotateCcw, Target, Trash2 } from "lucide-react";

import type { AssistantActionCardProps } from "./types";
import type {
  AssistantCardDraft,
  AssistantCardIconName,
  AssistantCardUndoOutcome,
  GoalAnswers,
} from "@keylow/core";
import type { LucideIcon } from "lucide-react";

// Only the icons a training card draws.
const icons = {
  Check,
  Archive,
  Target,
  Trash2,
  RotateCcw,
} as const satisfies Partial<Record<AssistantCardIconName, LucideIcon>>;

type TrainingIconName = keyof typeof icons;

const isTrainingIconName = (name: AssistantCardIconName): name is TrainingIconName => name in icons;

const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

type Appearance = {
  /** What an Undo pressed on the card came to. Leave it out for a card that has just arrived. */
  outcome?: AssistantCardUndoOutcome;
  /** Draws the card as it is while a workout is in progress. */
  workoutInProgress?: boolean;
  initiallyOpenDay?: number;
};

/**
 * The props of the card a story draws, made by running core's own card builder and `describeAssistantCard`
 * on a fixture input, as the boards were made, so no word in a story is typed here and none can drift.
 */
export function argsOfDraft(
  draft: AssistantCardDraft,
  { outcome, workoutInProgress = false, initiallyOpenDay }: Appearance = {},
): AssistantActionCardProps {
  const look = describeAssistantCard(withActionIds(draft, actionIds), outcome ?? null, {
    workoutInProgress,
  });
  if (!isTrainingIconName(look.icon)) {
    throw new RangeError(`The ${look.icon} icon is not a training card icon`);
  }
  const link = look.link;

  return {
    icon: icons[look.icon],
    iconTone: look.iconTone,
    title: look.title,
    subtitle: look.subtitle ?? undefined,
    rows: look.rows,
    days: look.days.length === 0 ? undefined : look.days,
    total: look.total ?? undefined,
    note: look.note ?? undefined,
    link: link === null ? undefined : { label: link.label, onPress: () => undefined },
    undo: { state: look.undo.state, label: look.undo.label, onPress: () => undefined },
    initiallyOpenDay,
  };
}

const routineId = "00000000-0000-4000-8000-0000000000e2";
const sessionId = "00000000-0000-4000-8000-0000000000e3";

const exercise = (name: string, isolation = false) => ({
  name,
  sets: 3,
  repMin: isolation ? 12 : 8,
  repMax: isolation ? 15 : 10,
  targetRir: isolation ? 1 : 2,
});

const fiveExerciseDay = (
  name: string,
  weekday: number,
  names: readonly [string, string, string, string, string],
) => ({
  name,
  weekday,
  exerciseCount: 5,
  setCount: 15,
  minutes: 50,
  exercises: [
    exercise(names[0]),
    exercise(names[1]),
    exercise(names[2]),
    exercise(names[3], true),
    exercise(names[4], true),
  ],
});

const pushDay = fiveExerciseDay("Push", 0, [
  "Barbell bench press",
  "Overhead press",
  "Incline dumbbell press",
  "Lateral raise",
  "Triceps pushdown",
]);
const pullDay = fiveExerciseDay("Pull", 2, [
  "Lat pulldown",
  "Barbell row",
  "Seated cable row",
  "Face pull",
  "Barbell curl",
]);
const legsDay = fiveExerciseDay("Legs", 4, [
  "Barbell squat",
  "Romanian deadlift",
  "Leg press",
  "Seated leg curl",
  "Standing calf raise",
]);

const weekdayNames = ["Chest", "Back", "Legs", "Upper", "Lower", "Shoulders", "Arms"];
const sevenDays = weekdayNames.map((name, weekday) => ({
  name,
  weekday,
  exerciseCount: 8,
  setCount: 24,
  minutes: 75,
  exercises: [
    exercise("Barbell bench press"),
    exercise("Barbell row"),
    exercise("Overhead press"),
    exercise("Lat pulldown"),
    exercise("Lateral raise", true),
    exercise("Face pull", true),
    exercise("Barbell curl", true),
    exercise("Triceps pushdown", true),
  ],
}));

export const threeDayRoutine = buildRoutineCreatedCard({
  routineId,
  name: "Push Pull Legs",
  goal: "aesthetic",
  experience: "intermediate",
  days: [pushDay, pullDay, legsDay],
  setsPerWeek: 45,
});

export const sevenDayRoutine = buildRoutineCreatedCard({
  routineId,
  name: "Seven day split",
  goal: "aesthetic",
  experience: "intermediate",
  days: sevenDays,
  setsPerWeek: 168,
});

export const routineUpdated = buildRoutineUpdatedCard({
  routineId,
  routineName: "Push Pull Legs",
  changes: [
    {
      op: "add",
      dayName: "Legs",
      exerciseName: "Leg extension",
      targets: { sets: 3, repMin: 12, repMax: 15, targetRir: 1 },
    },
    {
      op: "swap",
      dayName: "Legs",
      oldExerciseName: "Leg press",
      newExerciseName: "Hack squat",
      targets: { sets: 3, repMin: 10, repMax: 12, targetRir: 1 },
    },
    { op: "remove", dayName: "Legs", exerciseName: "Seated leg curl" },
    {
      op: "set_targets",
      dayName: "Legs",
      exerciseName: "Barbell squat",
      now: { sets: 4, repMin: 5, repMax: 8, targetRir: 2 },
      was: { sets: 3, repMin: 5, repMax: 8, targetRir: 2 },
    },
  ],
});

export const routineActive = buildRoutineActiveCard({
  routineId,
  name: "Push Pull Legs",
  previousName: "Upper Lower",
});

export const routineArchived = buildRoutineArchivedCard({ name: "Upper Lower" });

const goalsBefore: GoalAnswers = {
  goal: "aesthetic",
  focus: ["arms"],
  days_per_week: 4,
  session_minutes: 45,
  equipment: ["dumbbell", "bodyweight"],
  experience: "intermediate",
};

export const goalsUpdated = buildGoalsUpdatedCard({
  before: goalsBefore,
  after: { ...goalsBefore, goal: "strength", days_per_week: 3 },
});

const working = { setType: "working", rir: null, rpe: null } as const;

export const setUpdated = buildSetUpdatedCard({
  dayName: "Legs",
  localDate: "2026-10-08",
  sessionId,
  exerciseName: "Barbell squat",
  setNumber: 2,
  unit: "kg",
  before: { ...working, loadKg: 100, reps: 6 },
  after: { ...working, loadKg: 100, reps: 8 },
});

export const workoutDeleted = buildWorkoutDeletedCard({
  dayName: "Legs",
  localDate: "2026-10-08",
  setCount: 16,
});
