import { describe, expect, it } from "vitest";

import {
  WEEK_CARD,
  describeDaysComplete,
  describeOverTargetKcal,
  describeThisWeekCard,
  describeWeekAverageBasis,
  describeWeekAverageValue,
} from "../../src/copy";

const sample = {
  daysSoFar: 4,
  daysComplete: 2,
  daysLogged: 4,
  averageKcal: 1681.25,
  targetKcal: 2200,
};

describe("the This week card's words", () => {
  it("should pin the card's own sentences as brief 24 writes them", () => {
    expect(WEEK_CARD).toEqual({
      nothingLogged: "Nothing logged this week yet.",
      loadingLabel: "Loading this week",
      loadFailed: "Couldn't load this week",
      offlineUnavailable: "This week isn't available offline.",
    });
  });

  it("should keep every sentence non-empty and free of em dashes", () => {
    const sentences = [
      ...Object.values(WEEK_CARD),
      describeDaysComplete(2, 4),
      describeWeekAverageBasis(4),
      describeOverTargetKcal(250),
      describeWeekAverageValue(1681.25, 2200),
      describeThisWeekCard(sample, "diary"),
    ];

    for (const sentence of sentences) {
      expect(sentence.trim()).not.toBe("");
      expect(sentence).not.toContain("—");
    }
  });

  describe("describeDaysComplete", () => {
    it.each([
      [2, 4, "2 of 4 days complete"],
      [1, 1, "1 of 1 day complete"],
      [0, 4, "0 of 4 days complete"],
      [7, 7, "7 of 7 days complete"],
    ])("should write %i of %i as %j", (complete, soFar, expected) => {
      expect(describeDaysComplete(complete, soFar)).toBe(expected);
    });
  });

  describe("describeWeekAverageBasis", () => {
    it.each([
      [4, "From 4 days with food logged"],
      [1, "From 1 day with food logged"],
      [7, "From 7 days with food logged"],
    ])("should write %i days as %j", (days, expected) => {
      expect(describeWeekAverageBasis(days)).toBe(expected);
    });
  });

  describe("describeOverTargetKcal", () => {
    it("should write the overage with a plus sign and the thousands separator", () => {
      expect(describeOverTargetKcal(250)).toBe("+250 kcal");
      expect(describeOverTargetKcal(1250)).toBe("+1,250 kcal");
    });
  });

  describe("describeWeekAverageValue", () => {
    it("should write the average against the target", () => {
      expect(describeWeekAverageValue(1681.25, 2200)).toBe("1,681 / 2,200 kcal");
    });

    it("should write the average alone with no target", () => {
      expect(describeWeekAverageValue(1681.25, null)).toBe("1,681 kcal");
    });

    it("should round half up as formatCalories does", () => {
      expect(describeWeekAverageValue(1680.5, 2200)).toBe("1,681 / 2,200 kcal");
    });
  });

  describe("describeThisWeekCard", () => {
    it("should read the sample week as brief 24 writes it", () => {
      expect(describeThisWeekCard(sample, "diary")).toBe(
        "This week, open the diary. Average 1,681 of 2,200 kilocalories a day, from 4 days with food logged. 2 of 4 days complete.",
      );
    });

    it("should say open the week on the web", () => {
      expect(describeThisWeekCard(sample, "week")).toBe(
        "This week, open the week. Average 1,681 of 2,200 kilocalories a day, from 4 days with food logged. 2 of 4 days complete.",
      );
    });

    it("should drop the target when none is set", () => {
      expect(describeThisWeekCard({ ...sample, targetKcal: null }, "diary")).toBe(
        "This week, open the diary. Average 1,681 kilocalories a day, from 4 days with food logged. 2 of 4 days complete.",
      );
    });

    it("should say nothing is logged yet when no day has an average", () => {
      const nothingLogged = {
        ...sample,
        daysComplete: 0,
        daysLogged: 0,
        averageKcal: null,
      };

      expect(describeThisWeekCard(nothingLogged, "diary")).toBe(
        "This week, open the diary. Nothing logged this week yet. 0 of 4 days complete.",
      );
    });

    it("should say one day on a Monday", () => {
      const monday = { ...sample, daysSoFar: 1, daysComplete: 1, daysLogged: 1 };

      expect(describeThisWeekCard(monday, "diary")).toBe(
        "This week, open the diary. Average 1,681 of 2,200 kilocalories a day, from 1 day with food logged. 1 of 1 day complete.",
      );
    });
  });
});
