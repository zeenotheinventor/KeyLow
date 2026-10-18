import { describe, expect, it } from "vitest";

import { goalAnswersSchema } from "../../src/training";

import type { GoalAnswers } from "../../src/training";

/*
 * The goal questionnaire answers of KEY-398 (ADR 0005, Amendment 1: the focus list, days 1 to 7, minutes
 * 15 to 180). "Full gym" is the nine equipment values other than `other`, a screen shortcut that is not a
 * value of its own.
 */

const fullGym = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "ez_bar",
  "band",
  "bodyweight",
] as const;

const goldenAnswers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [...fullGym],
  experience: "intermediate",
};

const messagesOf = (answers: unknown): string[] => {
  const result = goalAnswersSchema.safeParse(answers);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe("goalAnswersSchema", () => {
  describe("accepted answers", () => {
    it("should accept the golden V-taper answers and return them unchanged", () => {
      expect(goalAnswersSchema.parse(goldenAnswers)).toStrictEqual(goldenAnswers);
    });

    it.each([["aesthetic"], ["strength"], ["hybrid"]])("should accept the goal %s", (goal) => {
      expect(goalAnswersSchema.safeParse({ ...goldenAnswers, goal }).success).toBe(true);
    });

    it("should accept an empty focus, such as a strength user with no focus", () => {
      expect(goalAnswersSchema.safeParse({ ...goldenAnswers, focus: [] }).success).toBe(true);
    });

    it("should accept every focus of the list at once", () => {
      const everyFocus = ["v_taper", "chest", "arms", "glutes", "legs", "overall"];

      expect(goalAnswersSchema.safeParse({ ...goldenAnswers, focus: everyFocus }).success).toBe(
        true,
      );
    });

    it.each([[1], [7]])("should accept %i days a week", (days_per_week) => {
      expect(goalAnswersSchema.safeParse({ ...goldenAnswers, days_per_week }).success).toBe(true);
    });

    it.each([[15], [180]])("should accept %i minutes", (session_minutes) => {
      expect(goalAnswersSchema.safeParse({ ...goldenAnswers, session_minutes }).success).toBe(true);
    });

    it("should accept all ten equipment values, other included", () => {
      const everyEquipment = [...fullGym, "other"];

      expect(
        goalAnswersSchema.safeParse({ ...goldenAnswers, equipment: everyEquipment }).success,
      ).toBe(true);
    });

    it.each([["beginner"], ["intermediate"], ["advanced"]])(
      "should accept the experience %s",
      (experience) => {
        expect(goalAnswersSchema.safeParse({ ...goldenAnswers, experience }).success).toBe(true);
      },
    );

    it("should leave out keys that are not answers", () => {
      const parsed = goalAnswersSchema.parse({ ...goldenAnswers, muscle_priority: { abs: 3 } });

      expect(parsed).toStrictEqual(goldenAnswers);
    });
  });

  describe("rejected answers", () => {
    it("should reject a focus chosen twice, naming the rule", () => {
      const messages = messagesOf({ ...goldenAnswers, focus: ["v_taper", "v_taper"] });

      expect(messages).toStrictEqual(["A focus can be chosen at most once"]);
    });

    it("should reject a focus outside the list, naming the rule and not the value", () => {
      const messages = messagesOf({ ...goldenAnswers, focus: ["calves"] });

      expect(messages).toStrictEqual(["Each focus must be one of the focus list"]);
      expect(messages.join()).not.toContain("calves");
    });

    it("should reject a goal outside the list, naming the rule and not the value", () => {
      const messages = messagesOf({ ...goldenAnswers, goal: "bulking" });

      expect(messages).toStrictEqual(["The goal must be one of the goal list"]);
      expect(messages.join()).not.toContain("bulking");
    });

    it.each([[0], [8], [3.5]])(
      "should reject %s days a week, naming the rule and not the value",
      (days_per_week) => {
        const messages = messagesOf({ ...goldenAnswers, days_per_week });

        expect(messages).toStrictEqual(["Days per week must be a whole number from 1 to 7"]);
        expect(messages.join()).not.toContain(String(days_per_week));
      },
    );

    it.each([[14], [181], [60.5]])(
      "should reject %s minutes, naming the rule and not the value",
      (session_minutes) => {
        const messages = messagesOf({ ...goldenAnswers, session_minutes });

        expect(messages).toStrictEqual(["Session minutes must be a whole number from 15 to 180"]);
        expect(messages.join()).not.toContain(String(session_minutes));
      },
    );

    it("should reject an equipment value outside the ten, naming the rule and not the value", () => {
      const messages = messagesOf({ ...goldenAnswers, equipment: ["barbell", "jetpack"] });

      expect(messages).toStrictEqual(["Each equipment must be one of the equipment list"]);
      expect(messages.join()).not.toContain("jetpack");
    });

    it("should reject an unknown experience, naming the rule and not the value", () => {
      const messages = messagesOf({ ...goldenAnswers, experience: "elite" });

      expect(messages).toStrictEqual(["The experience must be one of the experience list"]);
      expect(messages.join()).not.toContain("elite");
    });

    it("should reject an answer that is missing", () => {
      const withoutGoal = Object.fromEntries(
        Object.entries(goldenAnswers).filter(([key]) => key !== "goal"),
      );

      expect(goalAnswersSchema.safeParse(withoutGoal).success).toBe(false);
    });
  });
});
