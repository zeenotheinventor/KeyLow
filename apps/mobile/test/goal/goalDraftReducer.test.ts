import {
  goalDraftReducer,
  firstUnansweredStep,
  hasGoalAnswers,
  initialGoalDraft,
  isGoalStepAnswered,
} from "../../components/GoalQuestionnaire/goalDraftReducer";

import type { GoalDraftAnswers } from "../../components/GoalQuestionnaire/goalDraftReducer";

describe("the goal draft", () => {
  describe("at the start", () => {
    it("should have no goal, no days and no focus chosen yet", () => {
      expect(initialGoalDraft()).toStrictEqual({ focus: [] });
    });

    it("should start from the answers it is given, so a later ticket can open the flow filled", () => {
      expect(initialGoalDraft({ goal: "hybrid", focus: ["arms"], days_per_week: 5 })).toStrictEqual(
        { goal: "hybrid", focus: ["arms"], days_per_week: 5 },
      );
    });

    it("should leave the focus empty when the answers it is given have none", () => {
      expect(initialGoalDraft({ goal: "strength" })).toStrictEqual({
        goal: "strength",
        focus: [],
      });
    });

    it("should not keep a reference to the answers it is given", () => {
      const seed: GoalDraftAnswers = { focus: ["arms"] };

      const draft = initialGoalDraft(seed);

      expect(draft).not.toBe(seed);
      expect(draft.focus).not.toBe(seed.focus);
    });
  });

  describe("answering", () => {
    it("should keep the goal chosen", () => {
      const draft = goalDraftReducer(initialGoalDraft(), {
        type: "answered",
        answers: { goal: "strength" },
      });

      expect(draft.goal).toBe("strength");
    });

    it("should replace an earlier answer to the same question", () => {
      let draft = initialGoalDraft();
      draft = goalDraftReducer(draft, { type: "answered", answers: { days_per_week: 3 } });
      draft = goalDraftReducer(draft, { type: "answered", answers: { days_per_week: 5 } });

      expect(draft.days_per_week).toBe(5);
    });

    it("should keep the other answers when one changes", () => {
      let draft = initialGoalDraft({ goal: "aesthetic" });
      draft = goalDraftReducer(draft, { type: "answered", answers: { focus: ["chest", "arms"] } });

      expect(draft).toStrictEqual({ goal: "aesthetic", focus: ["chest", "arms"] });
    });

    it("should not change the draft it was given", () => {
      const before = initialGoalDraft();

      goalDraftReducer(before, { type: "answered", answers: { goal: "hybrid" } });

      expect(before).toStrictEqual({ focus: [] });
    });
  });

  describe("whether a step is answered", () => {
    it("should not count the goal until it is chosen", () => {
      expect(isGoalStepAnswered(initialGoalDraft(), 1)).toBe(false);
      expect(isGoalStepAnswered(initialGoalDraft({ goal: "hybrid" }), 1)).toBe(true);
    });

    it("should count the focus when it is empty, as a strength user may choose none", () => {
      expect(isGoalStepAnswered(initialGoalDraft(), 2)).toBe(true);
    });

    it("should not count a focus that names one twice", () => {
      expect(isGoalStepAnswered({ focus: ["arms", "arms"] }, 2)).toBe(false);
    });

    it("should not count the days until they are chosen", () => {
      expect(isGoalStepAnswered(initialGoalDraft(), 3)).toBe(false);
      expect(isGoalStepAnswered(initialGoalDraft({ days_per_week: 4 }), 3)).toBe(true);
    });

    it.each([0, 8, 2.5])("should not count %s days", (days) => {
      expect(isGoalStepAnswered(initialGoalDraft({ days_per_week: days }), 3)).toBe(false);
    });

    it.each([4, 5, 6])("should not count step %s before its answer is chosen", (step) => {
      expect(isGoalStepAnswered(initialGoalDraft(), step)).toBe(false);
    });

    it("should count the minutes, equipment and experience once they are valid", () => {
      expect(isGoalStepAnswered(initialGoalDraft({ session_minutes: 60 }), 4)).toBe(true);
      expect(isGoalStepAnswered(initialGoalDraft({ session_minutes: 10 }), 4)).toBe(false);
      expect(isGoalStepAnswered(initialGoalDraft({ equipment: ["barbell"] }), 5)).toBe(true);
      expect(isGoalStepAnswered(initialGoalDraft({ experience: "beginner" }), 6)).toBe(true);
    });
  });

  describe("whether anything has been answered", () => {
    it("should say no for a draft that has only its empty focus", () => {
      expect(hasGoalAnswers(initialGoalDraft())).toBe(false);
    });

    it.each([
      ["a goal", { goal: "strength" }],
      ["a focus", { focus: ["legs"] }],
      ["the days", { days_per_week: 2 }],
      ["the minutes", { session_minutes: 45 }],
      ["the equipment, even none", { equipment: [] }],
      ["the experience", { experience: "advanced" }],
    ] satisfies [string, GoalDraftAnswers][])("should say yes for %s", (_name, answers) => {
      expect(hasGoalAnswers(initialGoalDraft(answers))).toBe(true);
    });
  });

  describe("the first step still to answer before a step", () => {
    it("should be the first step when nothing is answered", () => {
      expect(firstUnansweredStep(initialGoalDraft(), 3)).toBe(1);
    });

    it("should skip the steps that are answered", () => {
      expect(firstUnansweredStep(initialGoalDraft({ goal: "hybrid" }), 4)).toBe(3);
    });

    it("should count the empty focus as answered", () => {
      expect(firstUnansweredStep(initialGoalDraft({ goal: "hybrid", days_per_week: 2 }), 4)).toBe(
        undefined,
      );
    });

    it("should be undefined for the first step, which has nothing before it", () => {
      expect(firstUnansweredStep(initialGoalDraft(), 1)).toBeUndefined();
    });

    it("should be undefined when every step before is answered", () => {
      expect(
        firstUnansweredStep(initialGoalDraft({ goal: "strength", days_per_week: 4 }), 3),
      ).toBeUndefined();
    });

    it("should not look at the step itself or the ones after it", () => {
      expect(firstUnansweredStep(initialGoalDraft({ goal: "strength" }), 2)).toBeUndefined();
    });
  });
});
