import { describe, expect, it } from "vitest";

import { NOW, NO_STREAKS, aDay, aStats, consecutiveDays } from "./builders";
import { evaluateAchievements } from "../../src/achievements";
import { MEASURES } from "../../src/achievements/rules";
import { toLocalDate } from "../../src/dates/toLocalDate";

import type { AchievementStats } from "../../src/achievements";
import type { RuleInput } from "../../src/achievements/rules";

const measure = (rule: keyof typeof MEASURES, stats: AchievementStats, now = NOW): number =>
  MEASURES[rule]({
    stats,
    streaks: NO_STREAKS,
    now,
    today: toLocalDate(now, stats.timeZone),
  } satisfies RuleInput);

// Manual targets in aStats: 2000 kcal (5 % is 100), 100 g protein, 200 g carbs and 70 g fat (5 g each).
const day = (overrides: Parameters<typeof aDay>[1] = {}) =>
  aDay("2026-11-10", { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 70, ...overrides });
const withDay = (overrides: Parameters<typeof aDay>[1] = {}) => aStats({ days: [day(overrides)] });

describe("in range (38 to 47)", () => {
  describe("calories", () => {
    it.each([
      [1900, 1],
      [2100, 1],
    ])("%i kcal sits exactly on the edge of the range", (kcal, expected) => {
      expect(measure("calorie-days", withDay({ kcal }))).toBe(expected);
    });

    it.each([1899, 2101])("%i kcal is just outside the range", (kcal) => {
      expect(measure("calorie-days", withDay({ kcal }))).toBe(0);
    });
  });

  describe("protein", () => {
    it("counts exactly at the target", () => {
      expect(measure("protein-days", withDay({ proteinG: 100 }))).toBe(1);
    });

    it("counts well over the target", () => {
      expect(measure("protein-days", withDay({ proteinG: 180 }))).toBe(1);
    });

    it("never counts under the target, even by a little", () => {
      expect(measure("protein-days", withDay({ proteinG: 99 }))).toBe(0);
    });
  });

  describe("carbs and fat", () => {
    it.each([
      [{ carbsG: 195 }, 1],
      [{ carbsG: 205 }, 1],
      [{ carbsG: 194 }, 0],
      [{ carbsG: 206 }, 0],
      [{ fatG: 65 }, 1],
      [{ fatG: 75 }, 1],
      [{ fatG: 64 }, 0],
      [{ fatG: 76 }, 0],
    ])("%j gives a balanced plate count of %i", (overrides, expected) => {
      expect(measure("balanced-days", withDay(overrides))).toBe(expected);
    });

    it("needs protein at the target too for a balanced plate", () => {
      expect(measure("balanced-days", withDay({ proteinG: 99 }))).toBe(0);
    });
  });

  it("never counts a day that is not complete", () => {
    const stats = withDay({ isComplete: false });
    expect(measure("calorie-days", stats)).toBe(0);
    expect(measure("protein-days", stats)).toBe(0);
  });

  it("never counts a day with no targets at all", () => {
    expect(measure("calorie-days", aStats({ days: [day()], manualTargets: null }))).toBe(0);
  });

  it("never counts a nutrient the manual targets leave unset", () => {
    const stats = aStats({
      days: [day()],
      manualTargets: { kcal: 2000, proteinG: null, carbsG: null, fatG: null },
    });
    expect(measure("calorie-days", stats)).toBe(1);
    expect(measure("protein-days", stats)).toBe(0);
    expect(measure("balanced-days", stats)).toBe(0);
  });

  describe("which targets judge a day", () => {
    const engineRows = [
      { effectiveFrom: "2026-11-01", kcal: 2500, proteinG: 150, carbsG: 250, fatG: 80 },
      { effectiveFrom: "2026-11-08", kcal: 3000, proteinG: 200, carbsG: 300, fatG: 90 },
    ];

    it("uses the engine row in force that day, the latest one that has started", () => {
      // 2026-11-10 is under the second row (3000 kcal), so 2500 kcal is out of range.
      const stats = aStats({ days: [day({ kcal: 2500 })], engineTargetsRows: engineRows });
      expect(measure("calorie-days", stats)).toBe(0);
      const earlier = aStats({
        days: [aDay("2026-11-05", { kcal: 2500 })],
        engineTargetsRows: engineRows,
      });
      expect(measure("calorie-days", earlier)).toBe(1);
    });

    it("uses an engine row that starts on the day itself", () => {
      const stats = aStats({
        days: [aDay("2026-11-08", { kcal: 3000 })],
        engineTargetsRows: engineRows,
      });
      expect(measure("calorie-days", stats)).toBe(1);
    });

    it("falls back to the manual targets before any engine row started", () => {
      const stats = aStats({
        days: [aDay("2026-10-20", { kcal: 2000 })],
        engineTargetsRows: engineRows,
      });
      expect(measure("calorie-days", stats)).toBe(1);
    });
  });

  describe("Perfect Week", () => {
    it("breaks a run at a day that is out of range", () => {
      const days = consecutiveDays(8, (date) =>
        aDay(date, { kcal: date === "2026-01-04" ? 1000 : 2000, proteinG: 100 }),
      );
      expect(measure("perfect-week-run", aStats({ days }))).toBe(4);
    });

    it("breaks a run at a missing day", () => {
      const days = [
        ...consecutiveDays(3, (date) => aDay(date, { kcal: 2000, proteinG: 100 })),
        aDay("2026-01-05", { kcal: 2000, proteinG: 100 }),
        aDay("2026-01-06", { kcal: 2000, proteinG: 100 }),
      ];
      expect(measure("perfect-week-run", aStats({ days }))).toBe(3);
    });

    it("does not need carbs or fat in range", () => {
      const days = consecutiveDays(7, (date) =>
        aDay(date, { kcal: 2000, proteinG: 100, carbsG: 0 }),
      );
      expect(measure("perfect-week-run", aStats({ days }))).toBe(7);
    });
  });
});

describe("day thresholds that sit on a clock or gram edge", () => {
  it("counts a first entry at 09:59 for Morning Logger but not one at exactly 10:00", () => {
    const at = (earliestEntryCreatedTime: string) =>
      measure(
        "morning-log-days",
        aStats({ days: [aDay("2026-11-10", { earliestEntryCreatedTime })] }),
      );
    expect(at("09:59")).toBe(1);
    expect(at("10:00")).toBe(0);
  });

  it("counts 25 g of fibre for Fibre Fan but not 24.9 g", () => {
    const of = (fibreG: number) =>
      measure("fibre-days", aStats({ days: [aDay("2026-11-10", { fibreG })] }));
    expect(of(25)).toBe(1);
    expect(of(24.9)).toBe(0);
  });
});

describe("personal records (92 to 95)", () => {
  const session = (
    startedAt: string,
    loadKg: number | null,
    reps: number,
    exerciseId = "squat",
  ) => ({
    startedAt,
    exercises: [{ exerciseId, loadKg, reps }],
  });
  const recordsOf = (sessionBests: ReturnType<typeof session>[]) =>
    measure("personal-records", aStats({ workouts: { ...aStats().workouts, sessionBests } }));

  it("never counts an exercise's first session", () => {
    expect(recordsOf([session("2026-03-01T10:00:00+00:00", 100, 5)])).toBe(0);
  });

  it("counts a heavier second session", () => {
    expect(
      recordsOf([
        session("2026-03-01T10:00:00+00:00", 100, 5),
        session("2026-03-08T10:00:00+00:00", 102.5, 5),
      ]),
    ).toBe(1);
  });

  it("counts more reps at the same load", () => {
    expect(
      recordsOf([
        session("2026-03-01T10:00:00+00:00", 100, 5),
        session("2026-03-08T10:00:00+00:00", 100, 6),
      ]),
    ).toBe(1);
  });

  it("does not count an equal set", () => {
    expect(
      recordsOf([
        session("2026-03-01T10:00:00+00:00", 100, 5),
        session("2026-03-08T10:00:00+00:00", 100, 5),
      ]),
    ).toBe(0);
  });

  it("does not count a lighter set, even for more reps", () => {
    expect(
      recordsOf([
        session("2026-03-01T10:00:00+00:00", 100, 5),
        session("2026-03-08T10:00:00+00:00", 90, 12),
      ]),
    ).toBe(0);
  });

  it("must beat the best of every earlier session, not only the last one", () => {
    expect(
      recordsOf([
        session("2026-03-01T10:00:00+00:00", 100, 5),
        session("2026-03-08T10:00:00+00:00", 80, 5),
        session("2026-03-15T10:00:00+00:00", 95, 5),
      ]),
    ).toBe(0);
  });

  it("reads the sessions oldest first whatever order they arrive in", () => {
    expect(
      recordsOf([
        session("2026-03-08T10:00:00+00:00", 102.5, 5),
        session("2026-03-01T10:00:00+00:00", 100, 5),
      ]),
    ).toBe(1);
  });

  it("judges each exercise on its own", () => {
    expect(
      recordsOf([
        session("2026-03-01T10:00:00+00:00", 100, 5, "squat"),
        session("2026-03-08T10:00:00+00:00", 60, 5, "bench"),
      ]),
    ).toBe(0);
  });

  it("treats a reps-only set as no load, so more reps is a record", () => {
    expect(
      recordsOf([
        session("2026-03-01T10:00:00+00:00", null, 10, "pull-up"),
        session("2026-03-08T10:00:00+00:00", null, 11, "pull-up"),
      ]),
    ).toBe(1);
  });
});

describe("Full Body (96)", () => {
  const weekWith = (
    primaryMuscleGroups: AchievementStats["workouts"]["weeks"][number]["primaryMuscleGroups"],
  ) =>
    aStats({
      workouts: {
        ...aStats().workouts,
        weeks: [{ weekStart: "2026-11-09", sessionCount: 3, primaryMuscleGroups }],
      },
    });

  it("is earned by all six main groups in one week", () => {
    expect(
      measure("full-body-week", weekWith(["chest", "shoulders", "back", "arms", "core", "legs"])),
    ).toBe(6);
  });

  it("does not count neck as one of the six", () => {
    expect(
      measure("full-body-week", weekWith(["chest", "shoulders", "back", "arms", "core", "neck"])),
    ).toBe(5);
  });

  it("does not add groups trained in different weeks together", () => {
    const stats = aStats({
      workouts: {
        ...aStats().workouts,
        weeks: [
          {
            weekStart: "2026-11-02",
            sessionCount: 2,
            primaryMuscleGroups: ["chest", "back", "legs"],
          },
          {
            weekStart: "2026-11-09",
            sessionCount: 2,
            primaryMuscleGroups: ["arms", "core", "shoulders"],
          },
        ],
      },
    });
    expect(measure("full-body-week", stats)).toBe(3);
  });
});

describe("programmes (110, 114) and Course Correct (115)", () => {
  it("counts a programme still running up to today for Signed Up", () => {
    // 28 days before 2026-11-19 is 2026-10-22.
    const running = (startedOn: string) => aStats({ programmes: [{ startedOn, endedOn: null }] });
    expect(measure("programme-weeks", running("2026-10-22"))).toBe(4);
    expect(measure("programme-weeks", running("2026-10-23"))).toBe(3);
  });

  it("takes the longest programme for Signed Up, not the sum", () => {
    const stats = aStats({
      programmes: [
        { startedOn: "2026-01-01", endedOn: "2026-01-15" },
        { startedOn: "2026-02-01", endedOn: "2026-02-22" },
      ],
    });
    expect(measure("programme-weeks", stats)).toBe(3);
  });

  it("counts check-ins only inside one programme for Graduate", () => {
    const stats = aStats({
      programmes: [
        { startedOn: "2026-01-01", endedOn: "2026-02-28" },
        { startedOn: "2026-03-01", endedOn: null },
      ],
      checkinLocalDates: [
        "2025-12-31",
        "2026-01-01",
        "2026-01-15",
        "2026-02-10",
        "2026-02-28",
        "2026-03-01",
        "2026-03-08",
        "2026-03-15",
      ],
    });
    // 4 inside the first (both ends included), 3 inside the second, 1 before either.
    expect(measure("check-ins-on-one-programme", stats)).toBe(4);
    expect(measure("check-ins", stats)).toBe(8);
  });

  it("counts no check-in for Graduate when there is no programme", () => {
    expect(
      measure("check-ins-on-one-programme", aStats({ checkinLocalDates: ["2026-03-01"] })),
    ).toBe(0);
  });

  it("earns Course Correct only when targets were updated after onboarding finished", () => {
    const edited = (targetsUpdatedAt: string | null, onboardingCompletedAt: string | null) =>
      measure("targets-edited", aStats({ targetsUpdatedAt, onboardingCompletedAt }));
    expect(edited("2026-02-01T10:00:00+00:00", "2026-01-10T10:00:00+00:00")).toBe(1);
    expect(edited("2026-01-10T10:00:00+00:00", "2026-01-10T10:00:00+00:00")).toBe(0);
    expect(edited("2026-01-09T10:00:00+00:00", "2026-01-10T10:00:00+00:00")).toBe(0);
    expect(edited(null, "2026-01-10T10:00:00+00:00")).toBe(0);
    expect(edited("2026-02-01T10:00:00+00:00", null)).toBe(0);
  });

  it("compares instants, not strings, across offsets", () => {
    const stats = aStats({
      onboardingCompletedAt: "2026-01-10T10:00:00+00:00",
      targetsUpdatedAt: "2026-01-10T10:30:00+02:00",
    });
    expect(measure("targets-edited", stats)).toBe(0);
  });
});

describe("counter-based items stay locked while their counter is absent", () => {
  it.each([
    "barcodes-scanned",
    "exercise-demos-watched",
    "shopping-items-ticked",
    "data-exports",
    "favourite-logs",
    "week-view-opens",
  ] as const)("%s reads nothing without its counter", (rule) => {
    expect(measure(rule, aStats())).toBe(0);
    expect(measure(rule, aStats({ eventCounters: {} }))).toBe(0);
  });

  it("keeps Nudge Me locked until a reminder is on", () => {
    expect(measure("reminder-enabled", aStats({ reminderEnabled: false }))).toBe(0);
    expect(measure("reminder-enabled", aStats({ reminderEnabled: true }))).toBe(1);
  });
});

describe("dates and time zones", () => {
  it("settles Anniversary on the local date of joining, not the UTC date", () => {
    // 2025-01-10 23:30 UTC is already 2025-01-11 in Auckland, so the anniversary is 2026-01-11 there.
    const stats = aStats({
      profileCreatedAt: "2025-01-10T23:30:00+00:00",
      timeZone: "Pacific/Auckland",
    });
    const dayBefore = new Date("2026-01-09T20:00:00Z"); // 2026-01-10 09:00 in Auckland
    const onTheDay = new Date("2026-01-10T20:00:00Z"); // 2026-01-11 09:00 in Auckland
    expect(measure("anniversary", stats, dayBefore)).toBeLessThan(365);
    expect(measure("anniversary", stats, onTheDay)).toBe(365);
  });

  it("moves a 29 February anniversary to 1 March", () => {
    const stats = aStats({ profileCreatedAt: "2028-02-29T09:00:00+00:00" });
    expect(measure("anniversary", stats, new Date("2029-02-28T12:00:00Z"))).toBeLessThan(365);
    expect(measure("anniversary", stats, new Date("2029-03-01T12:00:00Z"))).toBe(365);
  });

  it("only counts a seasonal day when something was logged on it", () => {
    const stats = aStats({ days: [aDay("2026-12-25", { entryCount: 0, isComplete: false })] });
    expect(measure("logged-on-christmas", stats)).toBe(0);
  });

  it("matches the month and day in any year", () => {
    expect(measure("logged-on-new-year", aStats({ days: [aDay("2031-01-01")] }))).toBe(1);
    expect(measure("logged-on-new-year", aStats({ days: [aDay("2031-11-01")] }))).toBe(0);
  });
});

describe("Collector and Completionist", () => {
  // 50 achievements earned through the plain counts, with no streak or day data.
  const manyEarned = aStats({
    entries: { ...aStats().entries, total: 5000, distinctFoods: 250, ownRecipeEntries: 50 },
    weighIns: { count: 365, distinctLocalDates: 365, beforeNineAmCount: 30 },
    recipeCount: 25,
    workouts: {
      ...aStats().workouts,
      finishedSessions: 500,
      workingSets: 10000,
      tonnageKg: 1000000,
    },
    bodyCompositionReadingCount: 50,
    featureRequestCount: 1,
  });

  const longStreaks = {
    ...NO_STREAKS,
    daily: { current: 500, longest: 500 },
    training: { current: 52, longest: 52 },
    weighIn: { current: 52, longest: 52 },
    freezesHeld: 10,
  };

  it("counts the other achievements earned, never itself", () => {
    const results = evaluateAchievements(manyEarned, longStreaks, NOW);
    const earnedOthers = results.filter(
      (result) => result.earned && result.id !== "collector" && result.id !== "completionist",
    ).length;
    const collector = results.find((result) => result.id === "collector");
    expect(earnedOthers).toBeGreaterThanOrEqual(50);
    expect(collector).toEqual({ id: "collector", earned: true });
  });

  it("shows progress toward 50 and toward 100 from the same count", () => {
    const results = evaluateAchievements(aStats(), NO_STREAKS, NOW);
    expect(results.find((result) => result.id === "collector")).toEqual({
      id: "collector",
      earned: false,
      progress: { current: 0, target: 50 },
    });
    expect(results.find((result) => result.id === "completionist")).toEqual({
      id: "completionist",
      earned: false,
      progress: { current: 0, target: 100 },
    });
  });
});
