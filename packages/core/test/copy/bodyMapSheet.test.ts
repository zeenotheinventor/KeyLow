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
    bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
    actualStatus: "growing",
    plannedStatus: "productive",
    volumeStatus: "growing",
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

const trainedSheet = (detail: MuscleDetail, overrides: Partial<MuscleSheetContext> = {}) => {
  const sheet = describeMuscleSheet(detail, { ...context, ...overrides });
  if (sheet.kind !== "trained") {
    throw new Error("Expected the sheet of a muscle with sets");
  }
  return sheet;
};

const notTrainedSheet = (detail: MuscleDetail, overrides: Partial<MuscleSheetContext> = {}) => {
  const sheet = describeMuscleSheet(detail, { ...context, ...overrides });
  if (sheet.kind !== "not_trained") {
    throw new Error("Expected the sheet of a muscle with no sets");
  }
  return sheet;
};

/** The weekly sets of a muscle with nothing done and nothing planned. */
const NO_SETS: Partial<MuscleDetail["weeklySets"]> = {
  actual: 0,
  planned: 0,
  actualStatus: "not_trained",
  plannedStatus: "not_trained",
  volumeStatus: "not_trained",
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

describe("describeMuscleSheet for a muscle with sets, the side delts of body · muscle-sheet", () => {
  it("should write every line as the board draws it", () => {
    expect(describeMuscleSheet(boardSideDelts, context)).toStrictEqual({
      kind: "trained",
      title: "Side delts",
      subtitle: "Shoulders",
      heat: { label: "Heat", value: "3 %", stepName: "Rested" },
      ready: { label: "Ready", value: "Now", caption: "Recovered from Monday" },
      weeklySets: {
        heading: "Sets this week · Mon 12 to Sun 18 Oct",
        plannedText: "11 planned",
        done: { value: "5.5", caption: "done · Growing" },
        barName:
          "5.5 sets done, Growing, 11 planned. Growing from 4 sets, Productive from 10, High above 20",
        barLabels: { start: "0", growing: "4", productive: "10", high: "20" },
        position:
          "Growing so far. Saturday's Push plans 5.5 more, which brings the week to 11, into Productive.",
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
    const sheet = trainedSheet(goldenDetail("delt_side"));

    expect(sheet.heat).toStrictEqual({ label: "Heat", value: "3 %", stepName: "Rested" });
    expect(sheet.ready).toStrictEqual({
      label: "Ready",
      value: "Now",
      caption: "Recovered from Monday",
    });
    expect(sheet.weeklySets.position).toBe(
      "Growing so far. Saturday's Push plans 5.5 more, which brings the week to 11, into Productive.",
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
      expect(trainedSheet(detailWith({ readyInHours })).ready).toStrictEqual({
        label: "Ready",
        value,
        caption,
      });
    });

    it("should give a muscle that is ready but was not trained in the window no caption", () => {
      expect(trainedSheet(detailWith({ lastTrained: null })).ready).toStrictEqual({
        label: "Ready",
        value: "Now",
        caption: null,
      });
    });
  });

  describe("recovered from", () => {
    const lastTrainedOn = (localDate: string) =>
      trainedSheet(
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
      expect(trainedSheet(detailWith({ lastTrained: null })).lastTrained).toStrictEqual({
        label: "Last trained",
        value: "Not in the last 14 days",
        exercises: null,
      });
    });

    it("should leave the routine day out of a session that was not a routine day", () => {
      const sheet = trainedSheet(
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
      statuses: Pick<MuscleDetail["weeklySets"], "actualStatus" | "plannedStatus">,
      sets: { actual: number; planned: number },
      overrides: Partial<MuscleSheetContext> = {},
    ) =>
      trainedSheet(detailWith({ weeklySets: { ...sets, ...statuses } }), overrides).weeklySets
        .position;

    it.each([
      [
        "growing",
        "productive",
        { actual: 5.5, planned: 11 },
        "Growing so far. Saturday's Push plans 5.5 more, which brings the week to 11, into Productive.",
      ],
      [
        "not_trained",
        "maintaining",
        { actual: 0, planned: 2 },
        "Not trained so far. Saturday's Push plans 2 more, which brings the week to 2, into Maintaining.",
      ],
      [
        "growing",
        "growing",
        { actual: 5, planned: 8 },
        "Growing so far. Saturday's Push plans 3 more, which brings the week to 8, still Growing.",
      ],
      [
        "productive",
        "high",
        { actual: 18, planned: 21 },
        "Productive so far. Saturday's Push plans 3 more, which brings the week to 21, into High.",
      ],
    ] as const)(
      "should write %s so far and %s by the end of the week",
      (actualStatus, plannedStatus, sets, sentence) => {
        expect(position({ actualStatus, plannedStatus }, sets)).toBe(sentence);
      },
    );

    it("should say that nothing more is planned when the plan adds no sets", () => {
      expect(
        position(
          { actualStatus: "productive", plannedStatus: "productive" },
          { actual: 12, planned: 12 },
        ),
      ).toBe("Productive so far. Nothing more is planned this week.");
    });

    it("should name two planned sessions with the plural verb", () => {
      expect(
        position(
          { actualStatus: "growing", plannedStatus: "productive" },
          { actual: 4, planned: 10 },
          {
            upcomingSessions: [{ localDate: "2026-10-16", routineDayName: "Pull" }, SATURDAYS_PUSH],
          },
        ),
      ).toBe(
        "Growing so far. Friday's Pull and Saturday's Push plan 6 more, which brings the week to 10, into Productive.",
      );
    });

    it("should say the plan when no planned session is named", () => {
      expect(
        position(
          { actualStatus: "growing", plannedStatus: "productive" },
          { actual: 5.5, planned: 11 },
          { upcomingSessions: [] },
        ),
      ).toBe(
        "Growing so far. The plan adds 5.5 more, which brings the week to 11, into Productive.",
      );
    });
  });

  describe("the bar", () => {
    it("should name the sets, the band, the plan and where each band starts, as the board does", () => {
      const { weeklySets } = trainedSheet(boardSideDelts);

      expect(weeklySets.barName).toBe(
        "5.5 sets done, Growing, 11 planned. Growing from 4 sets, Productive from 10, High above 20",
      );
      expect(weeklySets.done).toStrictEqual({ value: "5.5", caption: "done · Growing" });
      expect(weeklySets.plannedText).toBe("11 planned");
      expect(weeklySets.barLabels).toStrictEqual({
        start: "0",
        growing: "4",
        productive: "10",
        high: "20",
      });
    });

    it("should name the sets done by their own band", () => {
      const { weeklySets } = trainedSheet(
        detailWith({
          weeklySets: {
            actual: 21,
            planned: 21,
            actualStatus: "high",
            plannedStatus: "high",
            volumeStatus: "high",
          },
        }),
      );

      expect(weeklySets.done.caption).toBe("done · High");
      expect(weeklySets.barName).toContain("21 sets done, High, 21 planned.");
    });

    it("should name the sets done by the band they are in, not the band the plan reaches, in Projected", () => {
      // In Projected the detail's volume status is the planned figure's: 11 planned is Productive.
      const { weeklySets } = trainedSheet(
        detailWith({
          weeklySets: {
            actual: 5.5,
            planned: 11,
            actualStatus: "growing",
            plannedStatus: "productive",
            volumeStatus: "productive",
          },
        }),
      );

      expect(weeklySets.done).toStrictEqual({ value: "5.5", caption: "done · Growing" });
      expect(weeklySets.barName).toBe(
        "5.5 sets done, Growing, 11 planned. Growing from 4 sets, Productive from 10, High above 20",
      );
      expect(weeklySets.position).toMatch(/^Growing so far\./);
    });
  });

  describe("the weighting note", () => {
    it("should write an before a name that starts with a vowel", () => {
      expect(
        trainedSheet(boardSideDelts, {
          weightingExample: { exerciseName: "overhead press", weight: 0.5 },
        }).weightingNote,
      ).toBe(
        "Sets count by how much an exercise works the muscle, so an overhead press set counts as half a set for side delts.",
      );
    });

    const note = (weightingExample: MuscleSheetContext["weightingExample"]) =>
      trainedSheet(boardSideDelts, { weightingExample }).weightingNote;

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
    expect(trainedSheet(boardSideDelts, { weekStart: "2026-10-26" }).weeklySets.heading).toBe(
      "Sets this week · Mon 26 Oct to Sun 1 Nov",
    );
  });
});

describe("describeMuscleSheet for a muscle with no sets, the abs of body · muscle-sheet-not-targeted", () => {
  it("should write every line as the board draws it, from the golden week", () => {
    expect(describeMuscleSheet(goldenDetail("abs"), context)).toStrictEqual({
      kind: "not_trained",
      title: "Abs",
      subtitle: "Core · not trained this week",
      heat: { label: "Heat", value: "0 %", stepName: "Rested" },
      thisWeek: { label: "This week", value: "0 sets", statusName: "Not trained" },
      explanation:
        "No sets for abs this week, which runs Monday to Sunday. Any working set for abs moves them to Maintaining.",
      lastTrained: {
        label: "Last trained",
        value: "Not in the last 14 days",
        exercises: null,
      },
      actions: { editRoutine: "Edit routine" },
      footnote: "Add an exercise that works abs to your routine, and its sets count here.",
    });
  });

  it("should write a singular muscle with it", () => {
    const sheet = notTrainedSheet(detailWith({ muscle: "neck", weeklySets: NO_SETS }));

    expect(sheet.explanation).toBe(
      "No sets for neck this week, which runs Monday to Sunday. Any working set for neck moves it to Maintaining.",
    );
    expect(sheet.footnote).toBe(
      "Add an exercise that works neck to your routine, and its sets count here.",
    );
    expect(sheet.subtitle).toBe("Neck · not trained this week");
  });

  it("should write the last trained entry when the muscle was trained in the window, before this week", () => {
    const sheet = notTrainedSheet(detailWith({ muscle: "abs", weeklySets: NO_SETS }));

    expect(sheet.lastTrained.value).toBe("Mon 12 Oct · Push");
  });

  it("should give a muscle with sets planned but none done the sheet with the bar", () => {
    const sheet = describeMuscleSheet(
      detailWith({
        muscle: "quads",
        weeklySets: {
          actual: 0,
          planned: 5,
          actualStatus: "not_trained",
          plannedStatus: "growing",
        },
      }),
      context,
    );

    expect(sheet.kind).toBe("trained");
  });

  it("should give a muscle with sets done the sheet with the bar, whatever the plan targets", () => {
    const sheet = describeMuscleSheet(
      detailWith({
        muscle: "abs",
        targeting: { targeted: false, routineTrains: false, goalRanks: false },
        weeklySets: {
          actual: 2.5,
          planned: 2.5,
          actualStatus: "maintaining",
          plannedStatus: "maintaining",
          volumeStatus: "maintaining",
        },
      }),
      context,
    );

    expect(sheet.kind).toBe("trained");
  });
});

describe("the not trained sentence, for each of the 22 muscles", () => {
  // The names that read as one thing take "it". The rest are plural.
  const singular: readonly MuscleId[] = ["chest_upper", "chest_lower", "lower_back", "neck"];

  it.each(MUSCLE_IDS)("should agree with the name of %s", (muscle) => {
    const sheet = notTrainedSheet(detailWith({ muscle, weeklySets: NO_SETS }));
    const expectedEnding = singular.includes(muscle)
      ? "moves it to Maintaining."
      : "moves them to Maintaining.";

    expect(sheet.explanation).toContain(expectedEnding);
  });
});
