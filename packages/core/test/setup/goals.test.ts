import { describe, expect, it } from "vitest";

import { defaultGoalForAge, goalsAllowed, resetGoalForAge, withGoal } from "../../src/setup";

describe("goalsAllowed", () => {
  it("should not offer lose at 17", () => {
    expect(goalsAllowed(17)).toEqual(["maintain", "gain"]);
  });

  it("should offer all three goals at 18", () => {
    expect(goalsAllowed(18)).toEqual(["lose", "maintain", "gain"]);
  });

  it("should not offer lose at 13", () => {
    expect(goalsAllowed(13)).toEqual(["maintain", "gain"]);
  });

  it("should offer all three goals at 100", () => {
    expect(goalsAllowed(100)).toEqual(["lose", "maintain", "gain"]);
  });
});

describe("withGoal", () => {
  it("should bring the default lose rate back when the goal changes from maintain to lose", () => {
    expect(withGoal({ goal: "maintain", ratePctPerWeek: 0 }, "lose")).toEqual({
      goal: "lose",
      ratePctPerWeek: 0.5,
    });
  });

  it("should give the default gain rate when the goal changes to gain", () => {
    expect(withGoal({ goal: "lose", ratePctPerWeek: 1 }, "gain").ratePctPerWeek).toBe(0.25);
  });

  it("should set the rate to zero when the goal changes to maintain", () => {
    expect(withGoal({ goal: "lose", ratePctPerWeek: 0.75 }, "maintain").ratePctPerWeek).toBe(0);
  });

  it("should give the default rate when no goal was chosen yet", () => {
    expect(withGoal({}, "lose")).toEqual({ goal: "lose", ratePctPerWeek: 0.5 });
  });

  it("should keep the rate when the same goal is chosen again", () => {
    expect(withGoal({ goal: "lose", ratePctPerWeek: 0.75 }, "lose").ratePctPerWeek).toBe(0.75);
  });

  it("should keep every other answer", () => {
    expect(withGoal({ sex: "female", goal: "maintain", ratePctPerWeek: 0 }, "gain").sex).toBe(
      "female",
    );
  });
});

describe("defaultGoalForAge", () => {
  it("should be lose from 18", () => {
    expect(defaultGoalForAge(18)).toBe("lose");
    expect(defaultGoalForAge(40)).toBe("lose");
  });

  it("should be maintain under 18", () => {
    expect(defaultGoalForAge(17)).toBe("maintain");
    expect(defaultGoalForAge(13)).toBe("maintain");
  });
});

describe("resetGoalForAge", () => {
  it("should reset a lose goal to maintain, with its rate, when the age is under 18", () => {
    expect(resetGoalForAge({ sex: "male", goal: "lose", ratePctPerWeek: 0.75 }, 17)).toEqual({
      sex: "male",
      goal: "maintain",
      ratePctPerWeek: 0,
    });
  });

  it("should keep a goal that is allowed at the age", () => {
    const answers = { goal: "gain", ratePctPerWeek: 0.5 } as const;
    expect(resetGoalForAge(answers, 17)).toBe(answers);
  });

  it("should keep a lose goal at 18", () => {
    const answers = { goal: "lose", ratePctPerWeek: 0.75 } as const;
    expect(resetGoalForAge(answers, 18)).toBe(answers);
  });

  it("should leave a draft with no goal alone", () => {
    const answers = { sex: "female" } as const;
    expect(resetGoalForAge(answers, 17)).toBe(answers);
  });
});
