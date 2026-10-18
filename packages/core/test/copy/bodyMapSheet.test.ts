import { describe, expect, it } from "vitest";

import { describeHours, describeMuscleSheet, MUSCLE_SHEET } from "../../src/copy";
import { MUSCLE_IDS, muscleDetail } from "../../src/training";
import {
  comparison,
  GOLDEN_TIME_ZONE,
  actualStateAt,
  loggedSets,
  params,
  routine,
  sessionDayNames,
  THURSDAY_EVENING,
} from "../training/goldenWeekInputs";

import type { MuscleSheetContext } from "../../src/copy";
import type { MuscleDetail, MuscleId } from "../../src/training";

const SATURDAYS_PUSH = { localDate: "2026-10-17", routineDayName: "Push" };
const SIDE_DELTS_WEIGHT = { exerciseName: "shoulder press", weight: 0.5 };

const context: MuscleSheetContext = {
  weekStart: "2026-10-12",
  upcomingSessions: [SATURDAYS_PUSH],
  heatWindowDays: 14,
  weightingExample: SIDE_DELTS_WEIGHT,
};

/** The sheet of the side delts as `body · muscle-sheet` draws it, with the exercise names the board writes. */
const boardSideDelts: MuscleDetail = {
  muscle: "delt_side",
  heatPercent: 3,
  heatStep: 0,
  readyInHours: 0,
  weeklySets: {
    actual: 5.5,
    planned: 11,
    target: { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 },
    actualPosition: "below",
    plannedPosition: "inside",
    volumeStatus: "under",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: {
    localDate: "2026-10-12",
    sessionId: "session-1",
    routineDayName: "Push",
    exercises: [
      { exerciseId: "lateral-raise", name: "Side lateral raise", sets: 4 },
      { exerciseId: "military-press", name: "Seated barbell military press", sets: 3 },
    ],
  },
};

type DetailOverrides = Omit<Partial<MuscleDetail>, "weeklySets"> & {
  weeklySets?: Partial<MuscleDetail["weeklySets"]>;
};

const detailWith = (overrides: DetailOverrides): MuscleDetail => ({
  ...boardSideDelts,
  ...overrides,
  weeklySets: { ...boardSideDelts.weeklySets, ...overrides.weeklySets },
});

const goldenDetail = (muscle: MuscleId): MuscleDetail =>
  muscleDetail({
    muscle,
    state: actualStateAt(THURSDAY_EVENING),
    comparison,
    sets: loggedSets,
    sessions: sessionDayNames,
    targeted: { routine },
    view: "actual",
    now: THURSDAY_EVENING,
    tz: GOLDEN_TIME_ZONE,
    params,
  });

const targetedSheet = (detail: MuscleDetail, overrides: Partial<MuscleSheetContext> = {}) => {
  const sheet = describeMuscleSheet(detail, { ...context, ...overrides });
  if (sheet.kind !== "targeted") {
    throw new Error("Expected the sheet of a targeted muscle");
  }
  return sheet;
};

const notTargetedSheet = (detail: MuscleDetail, overrides: Partial<MuscleSheetContext> = {}) => {
  const sheet = describeMuscleSheet(detail, { ...context, ...overrides });
  if (sheet.kind !== "not_targeted") {
    throw new Error("Expected the sheet of a muscle that is not targeted");
  }
  return sheet;
};

describe("the fixed words of the muscle sheet", () => {
  it("should pin every string to the canvas source", () => {
    expect(MUSCLE_SHEET).toStrictEqual({
      heatLabel: "Heat",
      readyLabel: "Ready",
      readyNow: "Now",
      thisWeekLabel: "This week",
      lastTrainedLabel: "Last trained",
      barStart: "0",
      editRoutine: "Edit routine",
      editGoal: "Edit goal",
      notTargetedStatus: "Not targeted",
      weightingNote: "Sets count by how much an exercise works the muscle.",
    });
  });
});

describe("describeHours", () => {
  it("should write hour in the singular only for exactly one", () => {
    expect(describeHours(1)).toBe("1 hour");
    expect(describeHours(31)).toBe("31 hours");
  });
});

describe("describeMuscleSheet for a targeted muscle, the side delts of body · muscle-sheet", () => {
  it("should write every line as the board draws it", () => {
    expect(describeMuscleSheet(boardSideDelts, context)).toStrictEqual({
      kind: "targeted",
      title: "Side delts",
      subtitle: "Shoulders",
      heat: { label: "Heat", value: "3 %", stepName: "Rested" },
      ready: { label: "Ready", value: "Now", caption: "Recovered from Monday" },
      weeklySets: {
        heading: "Sets this week · Mon 12 to Sun 18 Oct",
        plannedText: "11 planned",
        done: { value: "5.5", caption: "done · target 10 to 16" },
        barName: "5.5 sets done, 11 planned, target 10 to 16, minimum 6, maximum 22",
        barLabels: { start: "0", minimum: "Min 6", planned: "Planned 11", maximum: "Max 22" },
        position:
          "Below target so far. Saturday's Push plans 5.5 more, which brings the week to 11, inside your target.",
      },
      lastTrained: {
        label: "Last trained",
        value: "Mon 12 Oct · Push",
        exercises: "Side lateral raise, 4 sets · Seated barbell military press, 3 sets",
      },
      weightingNote:
        "Sets count by how much an exercise works the muscle, so a shoulder press set counts as half a set for side delts.",
    });
  });

  it("should write the same numbers from the golden week at Thursday 19:00", () => {
    const sheet = targetedSheet(goldenDetail("delt_side"));

    expect(sheet.heat).toStrictEqual({ label: "Heat", value: "3 %", stepName: "Rested" });
    expect(sheet.ready).toStrictEqual({
      label: "Ready",
      value: "Now",
      caption: "Recovered from Monday",
    });
    expect(sheet.weeklySets.position).toBe(
      "Below target so far. Saturday's Push plans 5.5 more, which brings the week to 11, inside your target.",
    );
    expect(sheet.lastTrained.value).toBe("Mon 12 Oct · Push");
    // The exercise names are printed as stored, so the fixture's title case shows.
    expect(sheet.lastTrained.exercises).toBe(
      "Side Lateral Raise, 4 sets · Seated Barbell Military Press, 3 sets",
    );
  });

  describe("ready in", () => {
    it.each([
      [0, "Now", "Recovered from Monday"],
      [1, "In 1 hour", null],
      [31, "In 31 hours", null],
    ])("should write %d hours as %s with the caption %s", (readyInHours, value, caption) => {
      expect(targetedSheet(detailWith({ readyInHours })).ready).toStrictEqual({
        label: "Ready",
        value,
        caption,
      });
    });

    it("should give a muscle that is ready but was not trained in the window no caption", () => {
      expect(targetedSheet(detailWith({ lastTrained: null })).ready).toStrictEqual({
        label: "Ready",
        value: "Now",
        caption: null,
      });
    });
  });

  describe("recovered from", () => {
    const lastTrainedOn = (localDate: string) =>
      targetedSheet(
        detailWith({
          lastTrained: {
            localDate,
            sessionId: "session-1",
            routineDayName: "Push",
            exercises: [],
          },
        }),
      ).ready.caption;

    it("should name the weekday alone for a day in this week", () => {
      expect(lastTrainedOn("2026-10-12")).toBe("Recovered from Monday");
      expect(lastTrainedOn("2026-10-15")).toBe("Recovered from Thursday");
    });

    it("should name the date for a day before this week, where a bare weekday is ambiguous", () => {
      expect(lastTrainedOn("2026-10-11")).toBe("Recovered from Sun 11 Oct");
      expect(lastTrainedOn("2026-10-05")).toBe("Recovered from Mon 5 Oct");
    });
  });

  describe("last trained", () => {
    it("should say not in the window for a muscle with no last trained entry", () => {
      expect(targetedSheet(detailWith({ lastTrained: null })).lastTrained).toStrictEqual({
        label: "Last trained",
        value: "Not in the last 14 days",
        exercises: null,
      });
    });

    it("should leave the routine day out of a session that was not a routine day", () => {
      const sheet = targetedSheet(
        detailWith({
          lastTrained: {
            localDate: "2026-10-13",
            sessionId: "session-2",
            routineDayName: null,
            exercises: [{ exerciseId: "dip", name: "Dip", sets: 1 }],
          },
        }),
      );

      expect(sheet.lastTrained).toStrictEqual({
        label: "Last trained",
        value: "Tue 13 Oct",
        exercises: "Dip, 1 set",
      });
    });
  });

  describe("the position sentence", () => {
    const position = (
      actualPosition: MuscleDetail["weeklySets"]["actualPosition"],
      plannedPosition: MuscleDetail["weeklySets"]["plannedPosition"],
      sets: { actual: number; planned: number },
      overrides: Partial<MuscleSheetContext> = {},
    ) =>
      targetedSheet(
        detailWith({ weeklySets: { ...sets, actualPosition, plannedPosition } }),
        overrides,
      ).weeklySets.position;

    it.each([
      [
        "below",
        "inside",
        { actual: 5.5, planned: 11 },
        "Below target so far. Saturday's Push plans 5.5 more, which brings the week to 11, inside your target.",
      ],
      [
        "below",
        "below",
        { actual: 2, planned: 5 },
        "Below target so far. Saturday's Push plans 3 more, which brings the week to 5, below your target.",
      ],
      [
        "inside",
        "inside",
        { actual: 11, planned: 14 },
        "Inside target so far. Saturday's Push plans 3 more, which brings the week to 14, inside your target.",
      ],
      [
        "inside",
        "above",
        { actual: 15, planned: 18 },
        "Inside target so far. Saturday's Push plans 3 more, which brings the week to 18, above your target.",
      ],
      [
        "above",
        "above",
        { actual: 17, planned: 19.5 },
        "Above target so far. Saturday's Push plans 2.5 more, which brings the week to 19.5, above your target.",
      ],
    ] as const)(
      "should write %s so far and %s by the end of the week",
      (actualPosition, plannedPosition, sets, sentence) => {
        expect(position(actualPosition, plannedPosition, sets)).toBe(sentence);
      },
    );

    it("should say that nothing more is planned when the plan adds no sets", () => {
      expect(position("inside", "inside", { actual: 12, planned: 12 })).toBe(
        "Inside target so far. Nothing more is planned this week.",
      );
    });

    it("should name two planned sessions with the plural verb", () => {
      expect(
        position(
          "below",
          "inside",
          { actual: 4, planned: 10 },
          {
            upcomingSessions: [{ localDate: "2026-10-16", routineDayName: "Pull" }, SATURDAYS_PUSH],
          },
        ),
      ).toBe(
        "Below target so far. Friday's Pull and Saturday's Push plan 6 more, which brings the week to 10, inside your target.",
      );
    });

    it("should say the plan when no planned session is named", () => {
      expect(
        position("below", "inside", { actual: 5.5, planned: 11 }, { upcomingSessions: [] }),
      ).toBe(
        "Below target so far. The plan adds 5.5 more, which brings the week to 11, inside your target.",
      );
    });
  });

  describe("the weighting note", () => {
    it("should write an before a name that starts with a vowel", () => {
      expect(
        targetedSheet(boardSideDelts, {
          weightingExample: { exerciseName: "overhead press", weight: 0.5 },
        }).weightingNote,
      ).toBe(
        "Sets count by how much an exercise works the muscle, so an overhead press set counts as half a set for side delts.",
      );
    });

    const note = (weightingExample: MuscleSheetContext["weightingExample"]) =>
      targetedSheet(boardSideDelts, { weightingExample }).weightingNote;

    it("should state only the rule when there is no example", () => {
      expect(note(null)).toBe("Sets count by how much an exercise works the muscle.");
    });

    it.each([
      [0.5, "half a set"],
      [1, "a whole set"],
      [0.75, "0.75 of a set"],
    ])("should write a weight of %s as %s", (weight, share) => {
      expect(note({ exerciseName: "shoulder press", weight })).toBe(
        `Sets count by how much an exercise works the muscle, so a shoulder press set counts as ${share} for side delts.`,
      );
    });
  });

  it("should name both months in the heading of a week that crosses one", () => {
    expect(targetedSheet(boardSideDelts, { weekStart: "2026-10-26" }).weeklySets.heading).toBe(
      "Sets this week · Mon 26 Oct to Sun 1 Nov",
    );
  });
});

describe("describeMuscleSheet for a muscle that is not targeted, the abs of body · muscle-sheet-not-targeted", () => {
  it("should write every line as the board draws it, from the golden week", () => {
    expect(describeMuscleSheet(goldenDetail("abs"), context)).toStrictEqual({
      kind: "not_targeted",
      title: "Abs",
      subtitle: "Core · not targeted",
      heat: { label: "Heat", value: "0 %", stepName: "Rested" },
      thisWeek: { label: "This week", value: "0 sets", statusName: "Not targeted" },
      explanation:
        "Your routine does not train abs and your goal does not rank them, so they have no target this week and never read as under.",
      lastTrained: {
        label: "Last trained",
        value: "Not in the last 14 days",
        exercises: null,
      },
      actions: { editRoutine: "Edit routine", editGoal: "Edit goal" },
      footnote:
        "Add an exercise that works abs to your routine, or rank them in your goal, and they get a target.",
    });
  });

  it("should write the sets done so far when some were logged", () => {
    const sheet = notTargetedSheet(
      detailWith({
        muscle: "abs",
        targeting: { targeted: false, routineTrains: false, goalRanks: false },
        weeklySets: { actual: 2.5 },
      }),
    );

    expect(sheet.thisWeek.value).toBe("2.5 sets");
  });

  it("should write a singular muscle with it and a singular verb", () => {
    const sheet = notTargetedSheet(
      detailWith({
        muscle: "neck",
        targeting: { targeted: false, routineTrains: false, goalRanks: false },
      }),
    );

    expect(sheet.explanation).toBe(
      "Your routine does not train neck and your goal does not rank it, so it has no target this week and never reads as under.",
    );
    expect(sheet.footnote).toBe(
      "Add an exercise that works neck to your routine, or rank it in your goal, and it gets a target.",
    );
    expect(sheet.subtitle).toBe("Neck · not targeted");
  });

  it("should write the last trained entry when a not targeted muscle was trained in the window", () => {
    const sheet = notTargetedSheet(
      detailWith({
        muscle: "abs",
        targeting: { targeted: false, routineTrains: false, goalRanks: false },
      }),
    );

    expect(sheet.lastTrained.value).toBe("Mon 12 Oct · Push");
  });
});

describe("the not targeted sentence, for each of the 22 muscles", () => {
  // The names that read as one thing take "it", "has" and "reads". The rest are plural.
  const singular: readonly MuscleId[] = ["chest_upper", "chest_lower", "lower_back", "neck"];

  it.each(MUSCLE_IDS)("should agree with the name of %s", (muscle) => {
    const sheet = notTargetedSheet(
      detailWith({
        muscle,
        targeting: { targeted: false, routineTrains: false, goalRanks: false },
      }),
    );
    const expectedEnding = singular.includes(muscle)
      ? "does not rank it, so it has no target this week and never reads as under."
      : "does not rank them, so they have no target this week and never read as under.";

    expect(sheet.explanation).toContain(expectedEnding);
  });
});
