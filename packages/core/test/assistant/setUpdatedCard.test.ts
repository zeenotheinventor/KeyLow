import { describe, expect, it } from "vitest";

import {
  assistantCardSchema,
  buildSetUpdatedCard,
  describeAssistantChange,
  mergeAssistantCards,
  withActionIds,
} from "../../src/assistant";

import type { AssistantCard, SetUpdatedCardInput } from "../../src/assistant";

const sessionId = "00000000-0000-4000-8000-0000000b0001";
const firstActionId = "00000000-0000-4000-8000-0000000000d1";
const secondActionId = "00000000-0000-4000-8000-0000000000d2";
const thirdActionId = "00000000-0000-4000-8000-0000000000d3";

const working = { setType: "working", rir: null, rpe: null } as const;

// The board's one set in kg: set 2 of the barbell squat, 100 kg by 6 made 100 kg by 8.
const squatInKilograms: SetUpdatedCardInput = {
  dayName: "Legs",
  localDate: "2026-10-08",
  sessionId,
  exerciseName: "Barbell squat",
  setNumber: 2,
  unit: "kg",
  before: { ...working, loadKg: 100, reps: 6 },
  after: { ...working, loadKg: 100, reps: 8 },
};

const cardOf = (input: SetUpdatedCardInput, actionId: string): AssistantCard =>
  withActionIds(buildSetUpdatedCard(input), [actionId]);

describe("buildSetUpdatedCard", () => {
  it("should build the board's card for one set in kg", () => {
    expect(buildSetUpdatedCard(squatInKilograms)).toEqual({
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
      changeDetail: "Thu 8 Oct",
      totalText: null,
      note: null,
      link: { label: "Open the session", target: { screen: "session_detail", sessionId } },
      undo: "available",
      undoneSub: "Put back barbell squat, set 2, to 100 kg × 6",
    });
  });

  it("should word the loads in pounds for a person who trains in pounds", () => {
    const card = buildSetUpdatedCard({
      ...squatInKilograms,
      unit: "lb",
      setNumber: 1,
      before: { ...working, loadKg: 99.79, reps: 7 },
      after: { ...working, loadKg: 102.058, reps: 8 },
    });

    expect(card.rows).toMatchObject([
      { name: "Barbell squat, set 1", amountText: "Was 220 lb × 7", kcalText: "225 lb × 8" },
    ]);
    expect(card.undoneSub).toBe("Put back barbell squat, set 1, to 220 lb × 7");
  });

  it("should say a workout with no routine day was a workout", () => {
    const card = buildSetUpdatedCard({ ...squatInKilograms, dayName: null });

    expect(card.title).toBe("Changed a set in your workout");
  });

  it("should word a set with no load by its reps", () => {
    const card = buildSetUpdatedCard({
      ...squatInKilograms,
      before: { ...working, loadKg: null, reps: 10 },
      after: { ...working, loadKg: null, reps: 12 },
    });

    expect(card.rows).toMatchObject([{ amountText: "Was 10 reps", kcalText: "12 reps" }]);
  });

  it("should word a load that was added to a set that had none", () => {
    const card = buildSetUpdatedCard({
      ...squatInKilograms,
      before: { ...working, loadKg: null, reps: 8 },
      after: { ...working, loadKg: 20, reps: 8 },
    });

    expect(card.rows).toMatchObject([{ amountText: "Was 8 reps", kcalText: "20 kg × 8" }]);
  });

  it("should show the effort on both sides when only the effort changed", () => {
    const card = buildSetUpdatedCard({
      ...squatInKilograms,
      before: { ...working, loadKg: 100, reps: 8, rir: 2 },
      after: { ...working, loadKg: 100, reps: 8, rir: 1 },
    });

    expect(card.rows).toMatchObject([
      { amountText: "Was 100 kg × 8, RIR 2", kcalText: "100 kg × 8, RIR 1" },
    ]);
  });

  it("should show an effort that was cleared, and an RPE that replaced a RIR", () => {
    const cleared = buildSetUpdatedCard({
      ...squatInKilograms,
      before: { ...working, loadKg: 100, reps: 8, rir: 2 },
      after: { ...working, loadKg: 100, reps: 8 },
    });
    const replaced = buildSetUpdatedCard({
      ...squatInKilograms,
      before: { ...working, loadKg: 100, reps: 8, rir: 2 },
      after: { ...working, loadKg: 100, reps: 8, rir: null, rpe: 8.5 },
    });

    expect(cleared.rows).toMatchObject([
      { amountText: "Was 100 kg × 8, RIR 2", kcalText: "100 kg × 8, no RIR" },
    ]);
    expect(replaced.rows).toMatchObject([
      { amountText: "Was 100 kg × 8, RIR 2", kcalText: "100 kg × 8, RPE 8.5" },
    ]);
  });

  it("should show the type on both sides when the type changed", () => {
    const card = buildSetUpdatedCard({
      ...squatInKilograms,
      before: { ...working, loadKg: 60, reps: 8 },
      after: { ...working, setType: "warmup", loadKg: 60, reps: 8 },
    });

    expect(card.rows).toMatchObject([
      {
        name: "Barbell squat, warm-up set",
        amountText: "Was 60 kg × 8, working",
        kcalText: "60 kg × 8, warm-up",
      },
    ]);
  });

  it("should keep a name that starts with capitals as it is in the line under Undone", () => {
    const card = buildSetUpdatedCard({ ...squatInKilograms, exerciseName: "EZ-bar curl" });

    expect(card.undoneSub).toBe("Put back EZ-bar curl, set 2, to 100 kg × 6");
  });

  it("should build a card the app parses", () => {
    const card = cardOf(squatInKilograms, firstActionId);

    expect(assistantCardSchema.parse(card)).toEqual(card);
  });
});

describe("mergeAssistantCards, set_updated", () => {
  const threeSets = (input: Partial<SetUpdatedCardInput> = {}) =>
    [firstActionId, secondActionId, thirdActionId].map((actionId, index) =>
      cardOf(
        {
          ...squatInKilograms,
          unit: "lb",
          setNumber: index + 1,
          before: { ...working, loadKg: 99.79, reps: 7 },
          after: { ...working, loadKg: 102.058, reps: 8 },
          ...input,
        },
        actionId,
      ),
    );

  it("should merge three sets of one workout into the board's card", () => {
    const [first, ...others] = threeSets();
    if (first === undefined) {
      throw new Error("The fixture holds three cards");
    }

    const merged = mergeAssistantCards([first, ...others]);

    expect(merged).toMatchObject({
      kind: "set_updated",
      title: "Changed 3 sets in Legs",
      sub: "Thursday 8 October",
      changeDetail: "Thu 8 Oct",
      link: { label: "Open the session", target: { screen: "session_detail", sessionId } },
      undo: "available",
      undoneSub: "Put back 3 sets in Legs",
    });
    expect(merged.actionIds).toEqual([firstActionId, secondActionId, thirdActionId]);
    expect(merged.rows.map((row) => row.name)).toEqual([
      "Barbell squat, set 1",
      "Barbell squat, set 2",
      "Barbell squat, set 3",
    ]);
    expect(merged.rows.map((row) => row.kcalText)).toEqual([
      "225 lb × 8",
      "225 lb × 8",
      "225 lb × 8",
    ]);
    expect(assistantCardSchema.parse(merged)).toEqual(merged);
  });

  it("should say a workout with no routine day was a workout", () => {
    const [first, ...others] = threeSets({ dayName: null });
    if (first === undefined) {
      throw new Error("The fixture holds three cards");
    }

    const merged = mergeAssistantCards([first, ...others]);

    expect(merged.title).toBe("Changed 3 sets in your workout");
    expect(merged.undoneSub).toBe("Put back 3 sets in your workout");
  });

  it("should word sets of different workouts plainly, with no link and no day", () => {
    const other = cardOf(
      {
        ...squatInKilograms,
        dayName: "Push",
        localDate: "2026-10-12",
        sessionId: "00000000-0000-4000-8000-0000000b0002",
      },
      secondActionId,
    );

    const merged = mergeAssistantCards([cardOf(squatInKilograms, firstActionId), other]);

    expect(merged).toMatchObject({
      title: "Changed 2 sets",
      sub: null,
      changeDetail: null,
      link: null,
      undoneSub: "Put back 2 sets",
    });
    expect(merged.actionIds).toEqual([firstActionId, secondActionId]);
    expect(merged.rows).toHaveLength(2);
  });
});

describe("describeAssistantChange, update_past_set", () => {
  it("should count the sets of a row that groups several calls", () => {
    const words = (actionCount: number) =>
      describeAssistantChange({ tool: "update_past_set", actionCount, targets: [] });

    expect(words(1)).toEqual({ title: "Changed a set", detail: null });
    expect(words(3)).toEqual({ title: "Changed 3 sets", detail: null });
  });
});
