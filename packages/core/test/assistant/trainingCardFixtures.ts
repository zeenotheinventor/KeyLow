import type { AssistantCard, AssistantCardKind } from "../../src/assistant";

const actionId = "00000000-0000-4000-8000-0000000000d1";
export const routineId = "00000000-0000-4000-8000-0000000000e2";
export const sessionId = "00000000-0000-4000-8000-0000000000e3";

export const trainingCardKinds = [
  "routine_updated",
  "routine_active",
  "routine_archived",
  "routine_created",
  "goals_updated",
  "exercise_created",
  "exercise_updated",
  "exercise_archived",
  "set_updated",
  "workout_deleted",
] as const satisfies readonly AssistantCardKind[];

/** `assistant-card · routine-created`: three days, each with its exercises, the week's total and a link. */
export const routineCreatedCard: AssistantCard = {
  actionIds: [actionId],
  kind: "routine_created",
  title: "Built routine Push Pull Legs, 3 days",
  sub: null,
  rows: [],
  days: [
    {
      name: "Monday · Push",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [
        { name: "Bench press", detail: "3 sets · 8 to 10 reps · RIR 2" },
        { name: "Overhead press", detail: "3 sets · 8 to 10 reps · RIR 2" },
      ],
    },
    { name: "Wednesday · Pull", summary: "5 exercises · 15 sets · about 50 min", exercises: [] },
  ],
  changeDetail: null,
  totalText: "The week: 45 sets · 3 days",
  note: null,
  link: { label: "Open in routine editor", target: { screen: "routine_editor", routineId } },
  undo: "available",
  undoneSub: "Archived Push Pull Legs",
};

/** `assistant-card · routine-updated`: the changes list, as rows, with "4 changes" for the changes screen. */
export const routineUpdatedCard: AssistantCard = {
  actionIds: [actionId],
  kind: "routine_updated",
  title: "Updated routine Push Pull Legs",
  sub: "Legs · 4 changes",
  rows: [
    {
      name: "Changed Barbell squat",
      amountText: "Legs · 4 sets, was 3 · 5 to 8 reps, RIR 2",
      time: null,
      kcalText: null,
      match: null,
      matchedFood: null,
      estimate: false,
    },
  ],
  changeDetail: "4 changes",
  totalText: null,
  note: null,
  link: { label: "Open in routine editor", target: { screen: "routine_editor", routineId } },
  undo: "available",
  undoneSub: "Put Push Pull Legs back as it was",
};

/** `assistant-card · set-updated`: a row whose detail is "Was 100 kg × 6" and whose value is "100 kg × 8". */
export const setUpdatedCard: AssistantCard = {
  actionIds: [actionId],
  kind: "set_updated",
  title: "Changed a set in Legs",
  sub: "Thursday 8 October",
  rows: [
    {
      name: "Barbell squat, set 2",
      amountText: "Was 100 kg × 6",
      time: null,
      kcalText: "100 kg × 8",
      match: null,
      matchedFood: null,
      estimate: false,
    },
  ],
  totalText: null,
  note: null,
  link: { label: "Open the session", target: { screen: "session_detail", sessionId } },
  undo: "available",
  undoneSub: "Put the set back as it was",
};

export const cardOfKind = (kind: AssistantCardKind): AssistantCard => ({
  ...routineUpdatedCard,
  kind,
});

/** A card as it was stored before `days` and `changeDetail` existed: neither key is there. */
export const storedRoutineCard: AssistantCard = {
  actionIds: [actionId],
  kind: "routine_updated",
  title: "Updated routine Push Pull Legs",
  sub: null,
  rows: [],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: null,
};
