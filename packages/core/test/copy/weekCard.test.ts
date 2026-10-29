import { describe, expect, it } from "vitest";

import {
  WEEK_AVERAGES,
  WEEK_CARD,
  describeDaysComplete,
  describeOverTargetKcal,
  describeThisWeekCard,
  describeWeekAverageBasis,
  describeWeekAverageValue,
} from "../../src/copy";

// The board week on its Thursday: Mon 2,140, Tue 2,260 and Wed 1,286 before today, two days complete.
const sample = {
  daysSoFar: 4,
  daysComplete: 2,
  isFirstDay: false,
  daysLogged: 3,
  averageKcal: 5686 / 3,
  targetKcal: 2200,
};

describe("the This week card's words", () => {
  it("should pin the card's own sentences as brief 24 writes them", () => {
    expect(WEEK_CARD).toEqual({
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

  it("should have no nothing logged sentence of its own, since the card says the page's", () => {
    expect(WEEK_CARD).not.toHaveProperty("nothingLogged");
  });

  describe("describeThisWeekCard", () => {
    it("should read the board week with the average before today", () => {
      expect(describeThisWeekCard(sample, "diary")).toBe(
        "This week, open the diary. Average 1,895 of 2,200 kilocalories a day, from 3 days with food logged before today. 2 of 4 days complete.",
      );
    });

    it("should say open the week on the web", () => {
      expect(describeThisWeekCard(sample, "week")).toBe(
        "This week, open the week. Average 1,895 of 2,200 kilocalories a day, from 3 days with food logged before today. 2 of 4 days complete.",
      );
    });

    it("should say open your weekly averages when the card opens that page", () => {
      expect(describeThisWeekCard(sample, "averages")).toBe(
        "This week, open your weekly averages. Average 1,895 of 2,200 kilocalories a day, from 3 days with food logged before today. 2 of 4 days complete.",
      );
    });

    it("should drop the target when none is set", () => {
      expect(describeThisWeekCard({ ...sample, targetKcal: null }, "averages")).toBe(
        "This week, open your weekly averages. Average 1,895 kilocalories a day, from 3 days with food logged before today. 2 of 4 days complete.",
      );
    });

    it("should say one day when one day before today is logged", () => {
      const oneDay = { ...sample, daysSoFar: 2, daysComplete: 1, daysLogged: 1, averageKcal: 1800 };

      expect(describeThisWeekCard(oneDay, "averages")).toBe(
        "This week, open your weekly averages. Average 1,800 of 2,200 kilocalories a day, from 1 day with food logged before today. 1 of 2 days complete.",
      );
    });

    it("should say nothing is logged before today, in the page's words, when no earlier day has an average", () => {
      const nothingBeforeToday = { ...sample, daysComplete: 0, daysLogged: 0, averageKcal: null };

      expect(describeThisWeekCard(nothingBeforeToday, "averages")).toBe(
        "This week, open your weekly averages. Nothing logged before today this week. 0 of 4 days complete.",
      );
      expect(describeThisWeekCard(nothingBeforeToday, "averages")).toContain(
        WEEK_AVERAGES.nothingBeforeToday,
      );
    });

    it("should say the averages start tomorrow on a Monday, even with Monday logged", () => {
      const monday = {
        ...sample,
        daysSoFar: 1,
        daysComplete: 1,
        isFirstDay: true,
        daysLogged: 0,
        averageKcal: null,
      };

      expect(describeThisWeekCard(monday, "averages")).toBe(
        "This week, open your weekly averages. Your averages start tomorrow. 1 of 1 day complete.",
      );
      expect(describeThisWeekCard(monday, "averages")).toContain(WEEK_AVERAGES.startsTomorrow);
    });
  });
});
