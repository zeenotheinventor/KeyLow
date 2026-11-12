import { describe, expect, it } from "vitest";

import { DAY_ZERO, runCheckin, snapshotOf, targetsOf } from "./checkinRows";
import { PROGRAM_SCREEN, describeExpenditureSource } from "../../src/copy";
import { buildExpenditureChartView, buildProgramView } from "../../src/program";
import { goldenCheckinFixture } from "../../src/testing";

import type { BuildProgramViewInput, ProgramSnapshot } from "../../src/program";

/*
 * The Programme screen's view, which both apps draw. It is built from the rows the apps read, so these
 * tests run the golden check-in and hand its rows in the way the programme read holds them.
 */

const TODAY = "2026-04-20";
const PROGRAM = {
  goal: "lose",
  ratePctPerWeek: 0.5,
  proteinGPerKg: 1.6,
  splitPreset: "balanced",
  startedOn: "2026-04-02",
  nextCheckinDate: "2026-04-23",
} as const;
const NO_TARGETS = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };

const START: ProgramSnapshot = {
  kind: "start",
  asOfDate: "2026-04-02",
  muKcal: 2600,
  varKcal2: 90_000,
  measurement: null,
};

function inputOf(overrides: Partial<BuildProgramViewInput> = {}): BuildProgramViewInput {
  return {
    program: PROGRAM,
    latestSnapshot: START,
    previousSnapshot: null,
    currentTargets: null,
    targetsRead: NO_TARGETS,
    startBelief: null,
    fallbackWeightKg: null,
    unit: "kg",
    today: TODAY,
    ...overrides,
  };
}

describe("buildProgramView", () => {
  it("should give no view when there is no snapshot and no starting estimate", () => {
    expect(buildProgramView(inputOf({ latestSnapshot: null }))).toBeNull();
  });

  it("should read the starting estimate when the program has no snapshot yet", () => {
    const view = buildProgramView(
      inputOf({ latestSnapshot: null, startBelief: { muKcal: 2500, varKcal2: 90_000 } }),
    );

    expect(view?.hero.muKcal).toBe(2500);
    expect(view?.hero.isSettling).toBe(true);
  });

  it("should caption a settling estimate as a starting one even when a start snapshot is the newest", () => {
    expect(buildProgramView(inputOf())?.hero.captionText).toBe(PROGRAM_SCREEN.hero.settlingLine);
  });

  it("should be settling, with a checklist and no check-in card, while the start snapshot is the newest", () => {
    const view = buildProgramView(inputOf());

    expect(view?.hero.isSettling).toBe(true);
    expect(view?.checkin).toBeNull();
    expect(view?.settlingChecklist).toEqual({
      firstCheckinDate: "2026-04-23",
      daysLeft: 3,
      today: TODAY,
    });
  });

  describe("after a check-in", () => {
    const result = runCheckin(goldenCheckinFixture(DAY_ZERO), 14);
    const latest = snapshotOf(result);
    const view = buildProgramView(
      inputOf({
        latestSnapshot: latest,
        previousSnapshot: START,
        currentTargets: {
          ...targetsOf(result),
          effectiveFrom: latest.asOfDate,
          proteinG: 126,
          carbsG: 245,
          fatG: 73,
        },
      }),
    );

    it("should hand the check-in's own snapshot to its card, with the estimate before it", () => {
      expect(view?.checkin).toEqual({
        date: latest.asOfDate,
        previousMuKcal: START.muKcal,
        card: { snapshot: latest, programStartedOn: PROGRAM.startedOn, unit: "kg" },
      });
    });

    it("should say where the estimate comes from once a check-in made it", () => {
      expect(view?.hero.captionText).toBe(describeExpenditureSource(latest.asOfDate));
    });

    it("should no longer be settling and should show no checklist", () => {
      expect(view?.hero.isSettling).toBe(false);
      expect(view?.settlingChecklist).toBeNull();
    });

    it("should show the targets row's macros", () => {
      expect(view?.targets?.macros).toEqual({ proteinG: 126, carbsG: 245, fatG: 73 });
    });
  });

  it("should list the programme's own settings, without a rate for maintain", () => {
    const keys = (goal: string) =>
      buildProgramView(inputOf({ program: { ...PROGRAM, goal } }))?.details.map(({ key }) => key);

    expect(keys("lose")).toEqual(["goal", "rate", "protein", "diet"]);
    expect(keys("maintain")).toEqual(["goal", "protein", "diet"]);
  });

  it("should show no targets card while no calorie target is known", () => {
    expect(buildProgramView(inputOf())?.targets).toBeNull();
  });
});

describe("buildExpenditureChartView", () => {
  it("should give no chart when no week has an estimate", () => {
    expect(buildExpenditureChartView([{ week: "2026-04-13", kind: null, band: null }])).toBeNull();
  });

  it("should break the line and the band at a week with no estimate", () => {
    const view = buildExpenditureChartView([
      { week: "2026-04-06", kind: "start", band: { muKcal: 2600, lowKcal: 2500, highKcal: 2700 } },
      { week: "2026-04-13", kind: null, band: null },
      {
        week: "2026-04-20",
        kind: "checkin",
        band: { muKcal: 2580, lowKcal: 2430, highKcal: 2730 },
      },
    ]);

    expect(view?.points.map(({ value }) => value)).toEqual([2600, null, 2580]);
    expect(view?.band).toEqual([{ low: 2500, high: 2700 }, null, { low: 2430, high: 2730 }]);
  });

  describe("the sentence that names the chart", () => {
    const START_WEEK = {
      week: "2026-04-06",
      kind: "start",
      band: { muKcal: 2600, lowKcal: 2500, highKcal: 2700 },
    } as const;
    const CHECKIN_WEEK = {
      week: "2026-04-20",
      kind: "checkin",
      band: { muKcal: 2580, lowKcal: 2430, highKcal: 2730 },
    } as const;

    it("should read from the first estimate to the newest once a check-in made the newest", () => {
      const view = buildExpenditureChartView([
        START_WEEK,
        { week: "2026-04-13", kind: null, band: null },
        CHECKIN_WEEK,
      ]);

      expect(view?.summary).toBe(
        "Estimated expenditure over 3 weeks: 2,600 kcal a day in the week of 6 April, 2,580 now, likely 2,430 to 2,730.",
      );
    });

    it("should skip a leading week with no estimate when it finds the first", () => {
      const view = buildExpenditureChartView([
        { week: "2026-03-30", kind: null, band: null },
        START_WEEK,
        CHECKIN_WEEK,
      ]);

      expect(view?.summary).toContain("in the week of 6 April");
    });

    it("should use the starting wording while the newest estimate is a start snapshot", () => {
      const view = buildExpenditureChartView([
        { ...START_WEEK, week: "2026-04-13" },
        { ...START_WEEK, week: "2026-04-20" },
      ]);

      expect(view?.summary).toBe(
        "Estimated expenditure over 2 weeks: 2,600 kcal a day, a starting estimate from your answers, likely 2,500 to 2,700.",
      );
    });

    it("should name the newest estimate, not the first, when the weeks end in a skipped one", () => {
      const view = buildExpenditureChartView([
        START_WEEK,
        CHECKIN_WEEK,
        { week: "2026-04-27", kind: null, band: null },
      ]);

      expect(view?.summary).toContain("2,580 now");
    });
  });

  it("should write an axis value to the nearest 10 with a thousands separator", () => {
    const view = buildExpenditureChartView([
      {
        week: "2026-04-20",
        kind: "checkin",
        band: { muKcal: 2584, lowKcal: 2430, highKcal: 2730 },
      },
    ]);

    expect(view?.formatValue(2984)).toBe("2,980");
  });
});
