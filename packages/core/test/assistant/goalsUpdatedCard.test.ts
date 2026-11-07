import { describe, expect, it } from "vitest";

import { assistantCardSchema, buildGoalsUpdatedCard, withActionIds } from "../../src/assistant";
import { GOAL_STARTING_ANSWERS } from "../../src/training";

import type { GoalAnswers } from "../../src/training";

const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

const before: GoalAnswers = {
  goal: "aesthetic",
  focus: ["arms"],
  days_per_week: 4,
  session_minutes: 45,
  equipment: ["dumbbell", "bodyweight"],
  experience: "intermediate",
};

const row = (name: string, amountText: string | null, kcalText: string) => ({
  name,
  amountText,
  time: null,
  kcalText,
  match: null,
  matchedFood: null,
  estimate: false,
});

describe("buildGoalsUpdatedCard for a goal that changed", () => {
  it("should build the board's card for a new goal and a new number of days", () => {
    const draft = buildGoalsUpdatedCard({
      before,
      after: { ...before, goal: "strength", days_per_week: 3 },
    });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "goals_updated",
      title: "Updated your training goals",
      sub: null,
      rows: [row("Goal", "Was Look better", "Get stronger"), row("Days a week", "Was 4", "3")],
      changeDetail: "goal, days a week",
      totalText: null,
      note: "Your next suggestions use these goals. Your routines stay as they are.",
      link: null,
      undo: "available",
      undoneSub: "Put back your goal, Look better, and 4 days a week",
    });
  });

  it("should name only the answers that changed", () => {
    const draft = buildGoalsUpdatedCard({ before, after: { ...before, session_minutes: 60 } });

    expect(draft.rows).toEqual([row("Session", "Was 45 minutes", "60 minutes")]);
    expect(draft.changeDetail).toBe("session");
    expect(draft.undoneSub).toBe("Put back 45 minutes a session");
  });

  it("should word a list answer as the Goal screen does", () => {
    const draft = buildGoalsUpdatedCard({
      before,
      after: { ...before, focus: [], equipment: GOAL_STARTING_ANSWERS.equipment },
    });

    expect(draft.rows).toEqual([
      row("Focus", "Was Arms", "None"),
      row("Equipment", "Was Dumbbell and bodyweight", "Full gym"),
    ]);
    expect(draft.undoneSub).toBe(
      "Put back your focus, Arms, and your equipment, Dumbbell and bodyweight",
    );
  });

  it("should treat a list in another order as the same answer", () => {
    expect(() =>
      buildGoalsUpdatedCard({
        before,
        after: { ...before, equipment: ["bodyweight", "dumbbell"] },
      }),
    ).toThrow(RangeError);
  });

  it("should say 1 day and not 1 days", () => {
    const draft = buildGoalsUpdatedCard({
      before: { ...before, days_per_week: 1 },
      after: { ...before, days_per_week: 2 },
    });

    expect(draft.undoneSub).toBe("Put back 1 day a week");
  });
});

describe("buildGoalsUpdatedCard for a first goal", () => {
  const first: GoalAnswers = {
    ...GOAL_STARTING_ANSWERS,
    goal: "aesthetic",
    experience: "intermediate",
  };

  it("should build the card for a first goal from goal and experience, with the note", () => {
    const draft = buildGoalsUpdatedCard({ before: null, after: first, given: [] });

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      actionIds,
      kind: "goals_updated",
      title: "Saved your training goals",
      sub: null,
      rows: [row("Goal", null, "Look better"), row("Experience", null, "Intermediate")],
      changeDetail: "goal, experience",
      totalText: null,
      note: "Also set to start: 3 days a week, 60 minutes, full gym. Change them on the Goal screen.",
      link: null,
      undo: "available",
      undoneSub: "Your training goals are cleared",
    });
  });

  it("should name the days the person gave in the note and draw no row for them", () => {
    const draft = buildGoalsUpdatedCard({
      before: null,
      after: { ...first, days_per_week: 5 },
      given: ["days_per_week"],
    });

    expect(draft.rows.map(({ name }) => name)).toEqual(["Goal", "Experience"]);
    expect(draft.note).toBe(
      "Also set to start: 5 days a week, 60 minutes, full gym. Change them on the Goal screen.",
    );
  });

  it("should not call an answer the person gave a starting one", () => {
    const draft = buildGoalsUpdatedCard({
      before: null,
      after: { ...first, session_minutes: 45, equipment: ["dumbbell"] },
      given: ["session_minutes", "equipment"],
    });

    expect(draft.rows).toEqual([
      row("Goal", null, "Look better"),
      row("Session", null, "45 minutes"),
      row("Equipment", null, "Dumbbell"),
      row("Experience", null, "Intermediate"),
    ]);
    expect(draft.note).toBe("Also set to start: 3 days a week. Change it on the Goal screen.");
  });
});
