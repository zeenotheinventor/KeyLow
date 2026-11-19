import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  STREAK_CALENDAR,
  STREAK_WEEKS,
  describeCalendarDay,
  describeStreakChip,
  describeStreakMonth,
  describeTrainingStreak,
  describeWeekBar,
  describeWeekBars,
  describeWeekBarLabels,
  describeWeighInStreak,
} from "../../src/copy/streaks";

describe("describeStreakChip", () => {
  it("says only the number while the streak is kept", () => {
    expect(describeStreakChip("active", 12)).toEqual({
      text: "12",
      accessibleName: "12 day streak. Open streak calendar",
    });
  });

  it("asks to complete today when the streak is at risk", () => {
    expect(describeStreakChip("at_risk", 12)).toEqual({
      text: "12 · Complete today",
      accessibleName: "12 day streak, not complete today. Open streak calendar",
    });
  });

  it("says a freeze was used", () => {
    expect(describeStreakChip("freeze_used", 12)).toEqual({
      text: "12 · Freeze used",
      accessibleName: "12 day streak, freeze used. Open streak calendar",
    });
  });

  it("invites a first streak when there is none", () => {
    expect(describeStreakChip("none", 0)).toEqual({
      text: "Start a streak",
      accessibleName: "Start a streak. Open streak calendar",
    });
  });
});

describe("the calendar sheet's words", () => {
  it("has the board's words", () => {
    expect(STREAK_CALENDAR.title).toBe("Your streak");
    expect(STREAK_CALENDAR.subtitle).toBe("Complete a day in the Diary to keep it going.");
    expect(STREAK_CALENDAR.freezeExplanation).toBe(
      "You earn a freeze for every 7 days in a row, and from Gold and Platinum badges, level-ups and more. There is no limit to how many you hold.",
    );
    expect(STREAK_CALENDAR.legend).toEqual({
      complete: "Complete",
      frozen: "Frozen",
      missed: "Missed",
      atRisk: "Today, at risk",
    });
  });

  it("names the month as the board does", () => {
    expect(describeStreakMonth("2026-11-19")).toBe("November 2026");
  });

  it.each([
    ["complete", "1, complete"],
    ["frozen", "1, frozen"],
    ["missed", "1, missed"],
    ["at_risk", "1, today, not complete yet"],
    ["future", "1"],
  ] as const)("names a %s day", (state, name) => {
    expect(describeCalendarDay("2026-11-01", state)).toBe(name);
  });
});

describe("the weekly streaks' words", () => {
  it("titles the training streak and its best", () => {
    expect(describeTrainingStreak({ current: 6, longest: 9, achieved: 2, required: 4 })).toEqual({
      title: "6-week training streak",
      best: "Best 9",
      progress: "2 of 4 sessions this week. 2 more by Sunday to keep it.",
    });
  });

  it("says one more, not 1 more sessions", () => {
    expect(
      describeTrainingStreak({ current: 1, longest: 1, achieved: 3, required: 4 }).progress,
    ).toBe("3 of 4 sessions this week. 1 more by Sunday to keep it.");
  });

  it("drops the ask once the week has its sessions", () => {
    expect(
      describeTrainingStreak({ current: 7, longest: 9, achieved: 4, required: 4 }).progress,
    ).toBe("4 of 4 sessions this week.");
  });

  it("says session, singular, for a week that plans one", () => {
    expect(
      describeTrainingStreak({ current: 0, longest: 0, achieved: 0, required: 1 }).progress,
    ).toBe("0 of 1 session this week. 1 more by Sunday to keep it.");
  });

  it("invites a first training streak instead of naming zero weeks", () => {
    expect(describeTrainingStreak({ current: 0, longest: 0, achieved: 1, required: 3 })).toEqual({
      title: "Start a training streak this week",
      best: null,
      progress: "1 of 3 sessions this week. 2 more by Sunday to keep it.",
    });
  });

  it("invites a first weigh-in streak instead of naming zero weeks", () => {
    expect(describeWeighInStreak({ current: 0, longest: 0, thisWeek: "at_risk" })).toEqual({
      title: "Start a weigh-in streak this week",
      detail: "Weigh in by Sunday to keep it.",
    });
  });

  it("titles the weigh-in streak and says the week is done", () => {
    expect(describeWeighInStreak({ current: 9, longest: 14, thisWeek: "complete" })).toEqual({
      title: "9-week weigh-in streak",
      detail: "Weighed in this week. Best 14 weeks.",
    });
  });

  it("asks for a weigh-in when the week is at risk, and says week once", () => {
    expect(describeWeighInStreak({ current: 1, longest: 1, thisWeek: "at_risk" }).detail).toBe(
      "Weigh in by Sunday to keep it. Best 1 week.",
    );
  });

  it("labels the bars W1 to the week before, then Now", () => {
    expect(describeWeekBarLabels(8)).toEqual(["W1", "W2", "W3", "W4", "W5", "W6", "W7", "Now"]);
    expect(STREAK_WEEKS.barsName(8)).toBe("Last 8 weeks");
  });

  it("labels and names each bar, this week last", () => {
    const bars = describeWeekBars([
      { weekStart: "2026-11-02", state: "complete" },
      { weekStart: "2026-11-09", state: "missed" },
      { weekStart: "2026-11-16", state: "at_risk" },
    ]);

    expect(bars.map((bar) => bar.label)).toEqual(["W1", "W2", "Now"]);
    expect(bars.map((bar) => bar.name)).toEqual(["W1, complete", "W2, missed", "Now, at risk"]);
  });

  it.each([
    ["complete", "W3, complete"],
    ["missed", "W3, missed"],
    ["at_risk", "W3, at risk"],
  ] as const)("names a %s bar", (state, name) => {
    expect(describeWeekBar("W3", state)).toBe(name);
  });
});

describe("the streak words follow the prose rules", () => {
  it("has no em dash, double hyphen or semicolon, and never the older name", () => {
    const lines = [
      ...collectStrings(STREAK_CALENDAR),
      ...collectStrings(describeStreakChip("freeze_used", 3)),
      ...collectStrings(
        describeTrainingStreak({ current: 1, longest: 2, achieved: 1, required: 3 }),
      ),
      ...collectStrings(describeWeighInStreak({ current: 1, longest: 2, thisWeek: "at_risk" })),
    ];

    for (const line of lines) {
      expect(line).not.toMatch(/\u2014|--|;|keylow/i);
    }
  });
});
