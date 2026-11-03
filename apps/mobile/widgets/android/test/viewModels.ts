import { widgetViewModel } from "@keylow/core/widgets";

import {
  ENTRY_ID,
  EXERCISE_ID,
  NEW_ROW_ID,
  NOW,
  SESSION_ID,
  testSnapshot,
} from "../../../test/support/widgetFixtures";

import type {
  MessageViewModel,
  PendingUndo,
  ReadyViewModel,
  WidgetKind,
  WidgetSnapshot,
  WidgetSource,
} from "@keylow/core/widgets";

/** A Tuesday with a week behind it, a planned day and four sets of chest inside the heat window. */
export const populatedSnapshot = (): WidgetSnapshot => {
  const base = testSnapshot();
  const chestSet = (performedAt: string) => ({
    performedAt,
    setType: "working" as const,
    rir: 1,
    rpe: null,
    muscles: [{ muscleId: "chest_upper" as const, weight: 1 }],
  });

  return {
    ...base,
    week: base.week.map((day, position) => {
      if (position === 0) {
        return {
          ...day,
          isComplete: true,
          totals: { kcal: 2000, proteinG: 150, carbsG: 220, fatG: 60 },
        };
      }
      if (position === 1) {
        return { ...day, totals: { kcal: 1460, proteinG: 112, carbsG: 150, fatG: 48 } };
      }
      return day;
    }),
    training: {
      plan: {
        dayName: "Pull day",
        exerciseCount: 5,
        setCount: 15,
        exerciseNames: ["Rows", "Pull-ups", "Curls"],
      },
      session: null,
    },
    bodyMap: {
      ...base.bodyMap,
      heatSets: [
        chestSet("2026-11-03T09:00:00.000Z"),
        chestSet("2026-11-03T09:05:00.000Z"),
        chestSet("2026-11-03T09:10:00.000Z"),
        chestSet("2026-11-03T09:15:00.000Z"),
      ],
    },
  };
};

export const readySource = (snapshot: WidgetSnapshot = populatedSnapshot()): WidgetSource => ({
  status: "ready",
  snapshot,
});

const isReadyOf = <Kind extends WidgetKind>(
  model: ReadyViewModel | MessageViewModel,
  kind: Kind,
): model is Extract<ReadyViewModel, { kind: Kind }> =>
  model.state === "ready" && model.kind === kind;

/** The ready view model of one kind, which fails the test when core draws a message instead. */
export const readyModel = <Kind extends WidgetKind>(
  kind: Kind,
  source: WidgetSource = readySource(),
  context: Parameters<typeof widgetViewModel>[3] = {},
): Extract<ReadyViewModel, { kind: Kind }> => {
  const model = widgetViewModel(source, kind, NOW, context);
  if (!isReadyOf(model, kind)) {
    throw new Error(`Expected a ready ${kind} view model, got ${model.state}`);
  }

  return model;
};

/** The board D view model of one kind, which fails the test when core draws a ready widget. */
export const messageModel = (
  kind: WidgetKind,
  source: WidgetSource,
  context: Parameters<typeof widgetViewModel>[3] = {},
): MessageViewModel => {
  const model = widgetViewModel(source, kind, NOW, context);
  if (model.state === "ready") {
    throw new Error(`Expected a message for ${kind}, got a ready widget`);
  }

  return model;
};

export const RECENT_FOODS = [
  { id: ENTRY_ID, name: "Overnight oats", kcal: 410 },
  { id: "22222222-2222-4222-8222-222222222222", name: "Chicken wrap", kcal: 520 },
  { id: "33333333-3333-4333-8333-333333333333", name: "Protein shake", kcal: 180 },
] as const;

/** The populated snapshot with three recent foods, a weigh-in from yesterday and a running session. */
export const quickLogSnapshot = (): WidgetSnapshot => ({
  ...populatedSnapshot(),
  recentFoods: RECENT_FOODS.map((food) => ({
    entryId: food.id,
    name: food.name,
    kcal: food.kcal,
    amount: { quantity: 1, unit: "portion" as const },
  })),
  lastWeighIn: { weightKg: 78.4, localDate: "2026-11-02" },
});

/** The snapshot of a session 32 minutes in, on set 3 of 4 of the second exercise. */
export const sessionSnapshot = (): WidgetSnapshot => {
  const base = quickLogSnapshot();

  return {
    ...base,
    training: {
      ...base.training,
      session: {
        id: SESSION_ID,
        startedAt: "2026-11-03T11:28:00.000Z",
        dayName: "Pull day",
        next: {
          exerciseId: EXERCISE_ID,
          exerciseName: "Barbell row",
          exerciseNumber: 2,
          exerciseCount: 5,
          setNumber: 3,
          setCount: 4,
          loadKg: 70,
          reps: 8,
          lastTime: { loadKg: 67.5, reps: 8 },
        },
      },
    },
  };
};

export const pendingUndoOf = (
  action: PendingUndo["action"],
  sourceEntryId?: string,
): PendingUndo => ({
  action,
  rowId: NEW_ROW_ID,
  ...(sourceEntryId === undefined ? {} : { sourceEntryId }),
  at: NOW.toISOString(),
});
