import { describe, expect, it } from "vitest";

import { assistantCardSchema, buildRoutineCreatedCard, withActionIds } from "../../src/assistant";

const routineId = "00000000-0000-4000-8000-0000000000e2";
const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

const bench = { name: "Bench press", sets: 3, repMin: 8, repMax: 10, targetRir: 2 };
const press = { name: "Overhead press", sets: 3, repMin: 8, repMax: 10, targetRir: 2 };

const board = {
  routineId,
  name: "Push Pull Legs",
  goal: "aesthetic",
  experience: "intermediate",
  days: [
    {
      name: "Push",
      weekday: 0,
      exerciseCount: 5,
      setCount: 15,
      minutes: 50,
      exercises: [bench, press],
    },
    {
      name: "Pull",
      weekday: 2,
      exerciseCount: 5,
      setCount: 15,
      minutes: 50,
      exercises: [],
    },
    {
      name: "Legs",
      weekday: 4,
      exerciseCount: 5,
      setCount: 15,
      minutes: 50,
      exercises: [],
    },
  ],
  setsPerWeek: 45,
} as const;

describe("buildRoutineCreatedCard", () => {
  it("should build the board's card for a three day routine", () => {
    const card = assistantCardSchema.parse(
      withActionIds(buildRoutineCreatedCard(board), actionIds),
    );

    expect(card.kind).toBe("routine_created");
    expect(card.title).toBe("Built routine Push Pull Legs, 3 days");
    expect(card.sub).toBe("From your goal: look better, intermediate");
    expect(card.totalText).toBe("The week: 45 sets · 3 days");
    expect(card.note).toBe(
      "This is not your active routine. Ask to make it active, or do it in Routines.",
    );
    expect(card.link).toEqual({
      label: "Open in routine editor",
      target: { screen: "routine_editor", routineId },
    });
    expect(card.undo).toBe("available");
    expect(card.undoneSub).toBe(
      "Archived Push Pull Legs. You can restore it from Archived in Routines.",
    );
    expect(card.changeDetail).toBe("3 days · 45 sets a week");
    expect(card.rows).toEqual([]);
  });

  it("should draw one line for each day, with its weekday, summary and exercises", () => {
    const { days } = buildRoutineCreatedCard(board);

    expect(days?.[0]).toEqual({
      name: "Monday · Push",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [
        { name: "Bench press", detail: "3 sets · 8 to 10 reps · RIR 2" },
        { name: "Overhead press", detail: "3 sets · 8 to 10 reps · RIR 2" },
      ],
    });
    expect(days?.map(({ name }) => name)).toEqual([
      "Monday · Push",
      "Wednesday · Pull",
      "Friday · Legs",
    ]);
  });

  it("should say 1 day for a one day routine", () => {
    const card = buildRoutineCreatedCard({
      ...board,
      days: board.days.slice(0, 1),
      setsPerWeek: 15,
    });

    expect(card.title).toBe("Built routine Push Pull Legs, 1 day");
    expect(card.totalText).toBe("The week: 15 sets · 1 day");
    expect(card.changeDetail).toBe("1 day · 15 sets a week");
  });

  it("should give a day with no weekday its name alone", () => {
    const { days } = buildRoutineCreatedCard({
      ...board,
      days: [{ ...board.days[0], weekday: null }],
      setsPerWeek: 15,
    });

    expect(days?.[0]?.name).toBe("Push");
  });

  it("should leave RIR out when the exercise has no target and say one number for equal reps", () => {
    const { days } = buildRoutineCreatedCard({
      ...board,
      days: [
        {
          ...board.days[0],
          exercises: [{ name: "Squat", sets: 1, repMin: 5, repMax: 5, targetRir: null }],
        },
      ],
    });

    expect(days?.[0]?.exercises).toEqual([{ name: "Squat", detail: "1 set · 5 reps" }]);
  });

  it("should word the goal and the experience for each choice", () => {
    expect(
      buildRoutineCreatedCard({ ...board, goal: "strength", experience: "beginner" }).sub,
    ).toBe("From your goal: get stronger, beginner");
    expect(buildRoutineCreatedCard({ ...board, goal: "hybrid", experience: "advanced" }).sub).toBe(
      "From your goal: both, advanced",
    );
  });
});
