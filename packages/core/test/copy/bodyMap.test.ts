import { describe, expect, it } from "vitest";

import {
  BODY_MAP,
  BODY_MAP_LEGEND_ITEMS,
  describeBodyFigureLabel,
  describeBodyMapHeader,
  describeDashboardBodyMapCard,
  describeFigureRowValue,
  describeGapListRow,
  describeVolumeListRow,
  describeWebListCaption,
  describeHeatStep,
  describeGapNote,
  describeLegendCaption,
  describeMuscleListRow,
  describeNothingLogged,
  describePlannedSessions,
  describeProjectedAssumption,
  describeReadyIn,
  describeReadyInShort,
  describeSavedMoment,
  describeScrubberDay,
  describeSets,
  describeShortDate,
  describeWeekdayName,
  describeWeekRange,
  formatSetCount,
  GAP_VALUE_NAMES,
  HEAT_STEP_NAMES,
  VOLUME_STATUS_NAMES,
} from "../../src/copy";
import {
  GAP_VALUES,
  HEAT_STEP_CUTS_V1,
  heatStepOf,
  muscleListGroups,
  VOLUME_STATUSES,
} from "../../src/training";
import { actualStateAt, GOLDEN_TIME_ZONE, THURSDAY_EVENING } from "../training/goldenWeekInputs";

import type { BodyMapHeaderInput } from "../../src/copy";

const THURSDAY_19_00 = THURSDAY_EVENING;
const SUNDAY_20_00 = "2026-10-18T20:00:00+01:00";
const TUESDAY_20_00 = "2026-10-13T20:00:00+01:00";
const SATURDAYS_PUSH = { localDate: "2026-10-17", routineDayName: "Push" };

const header = (overrides: Partial<BodyMapHeaderInput>) =>
  describeBodyMapHeader({
    scale: "heat",
    view: "actual",
    at: THURSDAY_19_00,
    tz: GOLDEN_TIME_ZONE,
    isToday: true,
    weekEnd: "2026-10-18",
    plannedSessions: [],
    ...overrides,
  });

describe("the value words of the body map, keyed by the value itself", () => {
  it("should name heat steps 0 to 5 as the heat legend does", () => {
    expect(HEAT_STEP_NAMES).toStrictEqual({
      0: "Rested",
      1: "Ready",
      2: "Warm",
      3: "Hot",
      4: "Very hot",
      5: "Peak",
    });
  });

  it("should name every step that heatStepOf can return, and no other", () => {
    expect(Object.keys(HEAT_STEP_NAMES).map(Number)).toStrictEqual([
      ...Array(HEAT_STEP_CUTS_V1.length + 1).keys(),
    ]);
    for (const heat of [0, 0.04, 0.05, 0.2, 0.25, 0.26, 0.4, 0.6, 0.8, 1]) {
      expect(describeHeatStep(heatStepOf("lats", heat))).not.toBe("");
    }
  });

  it("should name every volume status by the status, not by its position", () => {
    expect(VOLUME_STATUS_NAMES).toStrictEqual({
      under: "Under",
      maintaining: "Maintaining",
      productive: "Productive",
      over: "Over",
      not_targeted: "Not targeted",
    });
    expect(Object.keys(VOLUME_STATUS_NAMES).sort()).toStrictEqual([...VOLUME_STATUSES].sort());
  });

  it("should name every gap value by the value, not by its position", () => {
    expect(GAP_VALUE_NAMES).toStrictEqual({
      behind: "Behind",
      on_plan: "On plan",
      ahead: "Ahead",
      not_in_plan: "Not in plan",
    });
    expect(Object.keys(GAP_VALUE_NAMES).sort()).toStrictEqual([...GAP_VALUES].sort());
  });

  it("should map every number volumeValues and gapValues can write to its word", () => {
    // The figure holds the index in VOLUME_STATUSES or GAP_VALUES, and reads the word through the value.
    expect(VOLUME_STATUSES.map((status) => VOLUME_STATUS_NAMES[status])).toStrictEqual([
      "Under",
      "Maintaining",
      "Productive",
      "Over",
      "Not targeted",
    ]);
    expect(GAP_VALUES.map((value) => GAP_VALUE_NAMES[value])).toStrictEqual([
      "Behind",
      "On plan",
      "Ahead",
      "Not in plan",
    ]);
  });

  it("should list the legend items in the order the boards draw them, with the same words", () => {
    expect(BODY_MAP_LEGEND_ITEMS).toStrictEqual({
      heat: ["Rested", "Ready", "Warm", "Hot", "Very hot", "Peak"],
      volume: ["Not targeted", "Under", "Maintaining", "Productive", "Over"],
      gap: ["Not in plan", "Behind", "On plan", "Ahead"],
    });
    expect([...BODY_MAP_LEGEND_ITEMS.volume].sort()).toStrictEqual(
      Object.values(VOLUME_STATUS_NAMES).sort(),
    );
    expect([...BODY_MAP_LEGEND_ITEMS.gap].sort()).toStrictEqual(
      Object.values(GAP_VALUE_NAMES).sort(),
    );
  });

  it("should refuse a heat step that is not a whole number from 0 to 5, naming the rule", () => {
    expect(() => describeHeatStep(6)).toThrow(
      new RangeError("A heat step must be a whole number from 0 to 5"),
    );
    expect(() => describeHeatStep(1.5)).toThrow(RangeError);
  });
});

describe("the dashboard card's legend ends", () => {
  it("should be the hottest and the coolest heat step", () => {
    expect(BODY_MAP.dashboardCard.hottestStep).toBe(HEAT_STEP_NAMES[5]);
    expect(BODY_MAP.dashboardCard.coolestStep).toBe(HEAT_STEP_NAMES[0]);
  });
});

describe("the fixed words of the body map, as the boards draw them", () => {
  it("should pin every string to the canvas source", () => {
    expect(BODY_MAP).toStrictEqual({
      title: "Body map",
      listTitle: "Muscles",
      // Deliberately off the canvas, which draws "Back to Train" alone: the screen also opens from the
      // dashboard and from a cold link, where "Back to Train" would name the wrong place.
      back: "Back",
      backToTrain: "Back to Train",
      muscleListButton: "Muscle list",
      closeSheet: "Close",
      sideBySideName: "Show side by side",
      scaleSwitch: { name: "Scale", heat: "Heat", volume: "Volume", gap: "Gap" },
      sideSwitch: { name: "Side shown", front: "Front", back: "Back" },
      legendNames: { heat: "Heat legend", volume: "Volume legend", gap: "Gap legend" },
      views: { actual: "Actual", projected: "Projected", gap: "Done against plan" },
      toggle: {
        showProjected: "Show projected",
        showActual: "Show actual",
        projectedNeedsRoutine: "Projected needs a routine.",
      },
      notes: {
        todayProjected:
          "Today, Projected shows what you have logged. A planned session counts from the next day, so pick a later day to see where your plan takes you.",
        sideBySide: "Both views show, so tapping the figures changes nothing here.",
        gap: "Gap compares this week's sets with your plan, so it has no Actual or Projected.",
        gapSoFar: "It counts your planned days up to yesterday, and today once you have logged it.",
      },
      coachMark: { text: "Long-press a muscle for details", dismiss: "Got it" },
      emptyState: {
        title: "Nothing to show yet",
        body: "Log a session and the muscles you train warm up here, then cool over a day or two as they recover.",
        action: "Start a session",
      },
      scrubber: { name: "Day shown", availableInProjected: "available in Projected" },
      figureLabels: {
        finishCard: { front: "This session's heat, front", back: "This session's heat, back" },
        goalsSummary: {
          front: "Your priorities on the body map, front",
          back: "Your priorities on the body map, back",
        },
      },
      figureHints: {
        muscleList: "The muscle list has each muscle\u2019s values.",
        openBodyMap: "Open the body map for each muscle.",
      },
      dashboardCard: {
        title: "Training",
        view: "Actual · now",
        link: "Body map",
        hottestStep: "Peak",
        coolestStep: "Rested",
        restDay: "Rest day",
        open: "Open the body map",
        loadingLabel: "Loading the body map",
        loadFailed: "Couldn't load the body map",
        offlineUnavailable: "The body map isn't available offline.",
      },
      trainCard: { openName: "Open body map" },
      figureSetting: {
        label: "Figure: male or female",
        sheetTitle: "Figure",
        description: "This changes how the body is drawn. Nothing else changes.",
        options: { male: "Male", female: "Female" },
      },
    });
  });
});

describe("describeLegendCaption", () => {
  it.each([
    ["heat", "mobile", "How hard and how recently each muscle worked. It cools as you recover."],
    [
      "heat",
      "web",
      "How hard and how recently each muscle worked. It cools as you recover. Press and hold a muscle, or pick it below, for its details.",
    ],
    [
      "volume",
      "mobile",
      "Sets this week against each muscle's target. Over means above the maximum.",
    ],
    [
      "volume",
      "web",
      "Sets this week against each muscle's target. A muscle your routine and goal leave out is not targeted, so it never reads as under.",
    ],
    ["gap", "mobile", "Sets done against your plan for the week. On plan means within 1 set."],
    ["gap", "web", "Sets done against your plan for the week. On plan means within 1 set."],
  ] as const)("should write the %s caption on %s as the board does", (scale, surface, caption) => {
    expect(describeLegendCaption({ scale, surface, onPlanToleranceSets: 1 })).toBe(caption);
  });

  it("should take the on plan tolerance from the input, in the plural when it is not 1", () => {
    expect(describeLegendCaption({ scale: "gap", surface: "mobile", onPlanToleranceSets: 2 })).toBe(
      "Sets done against your plan for the week. On plan means within 2 sets.",
    );
  });
});

describe("describeBodyMapHeader", () => {
  it("should read Actual now on Thursday as the actual heat board does", () => {
    expect(header({})).toStrictEqual({
      viewLabel: "Actual",
      subLine: "Now · Thu 15 Oct, 19:00",
      toggleLabel: "Show projected",
    });
  });

  it("should read Projected now on Thursday with the same line, as the projected today board does", () => {
    expect(header({ view: "projected" })).toStrictEqual({
      viewLabel: "Projected",
      subLine: "Now · Thu 15 Oct, 19:00",
      toggleLabel: "Show actual",
    });
  });

  it("should read Projected on Sunday with the sessions it assumes, as the projected heat board does", () => {
    expect(
      header({
        view: "projected",
        at: SUNDAY_20_00,
        isToday: false,
        plannedSessions: [SATURDAYS_PUSH],
      }),
    ).toStrictEqual({
      viewLabel: "Projected",
      subLine: "Sun 18 Oct, 20:00 · if you do Saturday's Push",
      toggleLabel: "Show actual",
    });
  });

  it("should leave out the assumption when no planned session falls before the day", () => {
    expect(header({ view: "projected", at: SUNDAY_20_00, isToday: false }).subLine).toBe(
      "Sun 18 Oct, 20:00",
    );
  });

  it("should read Actual on a past day with its date and no Now, as the scrubber board does", () => {
    expect(header({ at: TUESDAY_20_00, isToday: false })).toStrictEqual({
      viewLabel: "Actual",
      subLine: "Tue 13 Oct, 20:00",
      toggleLabel: "Show projected",
    });
  });

  it("should read projected volume by the end of the week, as the volume board does", () => {
    expect(header({ scale: "volume", view: "projected", at: SUNDAY_20_00 })).toStrictEqual({
      viewLabel: "Projected",
      subLine: "By Sun 18 Oct, if you follow the plan",
      toggleLabel: "Show actual",
    });
  });

  it("should read actual volume as the week so far at the moment", () => {
    expect(header({ scale: "volume" })).toStrictEqual({
      viewLabel: "Actual",
      subLine: "This week · as of Thu 15 Oct, 19:00",
      toggleLabel: "Show projected",
    });
  });

  it("should read the gap as done against plan, with no toggle, as the gap board does", () => {
    expect(header({ scale: "gap", at: SUNDAY_20_00, isToday: false })).toStrictEqual({
      viewLabel: "Done against plan",
      subLine: "This week · as of Sun 18 Oct, 20:00",
      toggleLabel: null,
    });
  });
});

describe("the lines under a view", () => {
  it("should name the planned sessions a projection assumes, with a capital for the side by side caption", () => {
    expect(describeProjectedAssumption([SATURDAYS_PUSH])).toBe("If you do Saturday's Push");
  });

  it("should join two sessions with and, and three with commas and and", () => {
    const friday = { localDate: "2026-10-16", routineDayName: "Pull" };
    const sunday = { localDate: "2026-10-18", routineDayName: "Legs" };

    expect(describePlannedSessions([friday, SATURDAYS_PUSH])).toBe(
      "Friday's Pull and Saturday's Push",
    );
    expect(describePlannedSessions([friday, SATURDAYS_PUSH, sunday])).toBe(
      "Friday's Pull, Saturday's Push and Sunday's Legs",
    );
  });

  it("should call a session with no routine day name a session", () => {
    expect(describePlannedSessions([{ localDate: "2026-10-17", routineDayName: null }])).toBe(
      "Saturday's session",
    );
  });

  it("should write the nothing logged line from the heat window, as the nothing logged board does", () => {
    expect(describeNothingLogged(14)).toBe("Nothing logged in the last 14 days");
    expect(describeNothingLogged(1)).toBe("Nothing logged in the last day");
  });

  it("should write the saved moment of the offline Train card", () => {
    expect(describeSavedMoment("2026-10-15T17:52:00+01:00", GOLDEN_TIME_ZONE)).toBe(
      "Saved · Thu 15 Oct, 17:52",
    );
  });

  it("should write the gap note, naming the missed sessions only when there are some", () => {
    const first = BODY_MAP.notes.gap;

    expect(describeGapNote([SATURDAYS_PUSH], "push muscles")).toBe(
      "Gap compares this week's sets with your plan, so it has no Actual or Projected. Saturday's Push was missed, so push muscles are behind.",
    );
    expect(describeGapNote([], "push muscles")).toBe(first);
  });

  it("should say were missed when several sessions were", () => {
    const friday = { localDate: "2026-10-16", routineDayName: "Pull" };

    expect(describeGapNote([friday, SATURDAYS_PUSH], "those muscles")).toContain(
      "Friday's Pull and Saturday's Push were missed, so those muscles are behind.",
    );
  });
});

describe("the labels of a body figure", () => {
  it.each([
    [
      { scale: "heat", view: "actual", side: "front", hint: "muscleList" },
      "Body map, Actual, heat, front. The muscle list has each muscle’s values.",
    ],
    [{ scale: "heat", view: "actual", side: "back", hint: null }, "Body map, Actual, heat, back"],
    [
      { scale: "heat", view: "actual", side: "front", hint: "openBodyMap" },
      "Body map, Actual, heat, front. Open the body map for each muscle.",
    ],
    [
      { scale: "volume", view: "projected", side: "front", hint: "muscleList" },
      "Body map, Projected, weekly sets, front. The muscle list has each muscle’s values.",
    ],
    [
      { scale: "gap", view: "actual", side: "back", hint: null },
      "Body map, Done against plan, gap, back",
    ],
    [
      { scale: "heat", view: "projected", side: "front", hint: null },
      "Body map, Projected, heat, front",
    ],
  ] as const)("should write %j as the board does", (input, label) => {
    expect(describeBodyFigureLabel(input)).toBe(label);
  });
});

describe("describeScrubberDay", () => {
  const scrubberDay = (state: Parameters<typeof describeScrubberDay>[0]["state"], rest = {}) =>
    describeScrubberDay({
      localDate: "2026-10-12",
      isToday: false,
      onlyInProjected: false,
      state,
      ...rest,
    });

  it("should write a logged day as the scrubber board does", () => {
    expect(scrubberDay({ kind: "logged", routineDayName: "Push" })).toStrictEqual({
      weekday: "Mon",
      dayOfMonth: "12",
      accessibleName: "Monday 12 October, Push, logged",
    });
  });

  it("should write a rest day", () => {
    expect(scrubberDay({ kind: "rest" }, { localDate: "2026-10-14" }).accessibleName).toBe(
      "Wednesday 14 October, rest day",
    );
  });

  it("should write today in progress", () => {
    expect(
      scrubberDay(
        { kind: "in_progress", routineDayName: "Legs" },
        { localDate: "2026-10-15", isToday: true },
      ).accessibleName,
    ).toBe("Thursday 15 October, today, Legs in progress");
  });

  it("should write a planned day that only Projected can pick, with the suffix", () => {
    expect(
      scrubberDay(
        { kind: "planned", routineDayName: "Push" },
        { localDate: "2026-10-17", onlyInProjected: true },
      ).accessibleName,
    ).toBe("Saturday 17 October, Push, planned, available in Projected");
  });

  it("should name a missed day missed, and a session with no name by its state alone", () => {
    expect(
      scrubberDay({ kind: "missed", routineDayName: "Push" }, { localDate: "2026-10-17" })
        .accessibleName,
    ).toBe("Saturday 17 October, Push, missed");
    expect(scrubberDay({ kind: "logged", routineDayName: null }).accessibleName).toBe(
      "Monday 12 October, logged",
    );
    expect(
      scrubberDay({ kind: "in_progress", routineDayName: null }, { isToday: true }).accessibleName,
    ).toBe("Monday 12 October, today, in progress");
  });
});

describe("ready in", () => {
  it.each([
    [0, "ready now", "ready now"],
    [1, "ready in 1 hour", "ready in 1 h"],
    [31, "ready in 31 hours", "ready in 31 h"],
  ])("should write %d hours as %s, and %s in the row text", (hours, spoken, short) => {
    expect(describeReadyIn(hours)).toBe(spoken);
    expect(describeReadyInShort(hours)).toBe(short);
  });
});

describe("describeMuscleListRow, on the golden Thursday 19:00", () => {
  const rows = muscleListGroups(actualStateAt(THURSDAY_19_00), THURSDAY_19_00).flatMap(
    (group) => group.rows,
  );
  const rowOf = (muscle: string) => {
    const row = rows.find((candidate) => candidate.muscle === muscle);
    if (row === undefined) {
      throw new Error(`No row for ${muscle}`);
    }
    return describeMuscleListRow(row);
  };

  it("should write the side delts as the ticket's accessible name does", () => {
    expect(rowOf("delt_side")).toStrictEqual({
      name: "Side delts",
      heatText: "3 %",
      status: "Rested · ready now",
      accessibleName: "Side delts, heat 3 percent, rested, ready now, open details",
    });
  });

  it("should write a muscle that is not ready with the hours abbreviated, and spoken in full", () => {
    expect(rowOf("glute_max")).toStrictEqual({
      name: "Glutes",
      heatText: "40 %",
      status: "Hot · ready in 19 h",
      accessibleName: "Glutes, heat 40 percent, hot, ready in 19 hours, open details",
    });
  });

  it("should write hamstrings at 55 percent as hot and ready in 31 hours", () => {
    expect(rowOf("hamstrings").status).toBe("Hot · ready in 31 h");
  });

  it("should write a very hot muscle with its step lower case in the accessible name", () => {
    expect(
      describeMuscleListRow({ muscle: "quads", heatPercent: 65, heatStep: 4, readyInHours: 1 }),
    ).toMatchObject({
      status: "Very hot · ready in 1 h",
      accessibleName: "Quads, heat 65 percent, very hot, ready in 1 hour, open details",
    });
  });
});

describe("describeDashboardBodyMapCard", () => {
  const warmest = [
    { muscle: "lats", percent: 25 },
    { muscle: "traps_mid", percent: 18 },
    { muscle: "biceps", percent: 15 },
  ] as const;

  it("should write the warmest muscles, today and the whole card's name as the dashboard board does", () => {
    expect(
      describeDashboardBodyMapCard({
        warmest,
        today: { kind: "session", routineDayName: "Legs", plannedSets: 16 },
        heatWindowDays: 14,
        opensBodyMap: true,
      }),
    ).toStrictEqual({
      warmestLine: "Warmest: lats 25 %, mid traps 18 %, biceps 15 %",
      todayLine: "Today: Legs",
      accessibleName:
        "Body map, Actual heat now. Warmest: lats 25 percent, mid traps 18 percent, biceps 15 percent. Today: Legs, 16 sets planned. Open the body map",
    });
  });

  it("should write a rest day", () => {
    const card = describeDashboardBodyMapCard({
      warmest,
      today: { kind: "rest" },
      heatWindowDays: 14,
      opensBodyMap: true,
    });

    expect(card.todayLine).toBe("Today: Rest day");
    expect(card.accessibleName.endsWith("Today: Rest day. Open the body map")).toBe(true);
  });

  it("should write no history with the nothing logged line, and leave today out without a routine", () => {
    expect(
      describeDashboardBodyMapCard({
        warmest: [],
        today: null,
        heatWindowDays: 14,
        opensBodyMap: true,
      }),
    ).toStrictEqual({
      warmestLine: "Nothing logged in the last 14 days",
      todayLine: null,
      accessibleName:
        "Body map, Actual heat now. Nothing logged in the last 14 days. Open the body map",
    });
  });

  it("should write one planned set in the singular", () => {
    expect(
      describeDashboardBodyMapCard({
        warmest,
        today: { kind: "session", routineDayName: "Legs", plannedSets: 1 },
        heatWindowDays: 14,
        opensBodyMap: true,
      }).accessibleName,
    ).toContain("Today: Legs, 1 set planned.");
  });

  describe("when the card does not open the body map yet", () => {
    it("should end the name with the last sentence about today and leave out the words that open it", () => {
      expect(
        describeDashboardBodyMapCard({
          warmest,
          today: { kind: "session", routineDayName: "Legs", plannedSets: 16 },
          heatWindowDays: 14,
          opensBodyMap: false,
        }).accessibleName,
      ).toBe(
        "Body map, Actual heat now. Warmest: lats 25 percent, mid traps 18 percent, biceps 15 percent. Today: Legs, 16 sets planned.",
      );
    });

    it("should end the no-history name with the nothing logged sentence", () => {
      expect(
        describeDashboardBodyMapCard({
          warmest: [],
          today: null,
          heatWindowDays: 14,
          opensBodyMap: false,
        }).accessibleName,
      ).toBe("Body map, Actual heat now. Nothing logged in the last 14 days.");
    });

    it("should change nothing but the name", () => {
      const input = {
        warmest,
        today: { kind: "rest" },
        heatWindowDays: 14,
      } as const;
      const { accessibleName: closedName, ...closedWords } = describeDashboardBodyMapCard({
        ...input,
        opensBodyMap: false,
      });
      const { accessibleName: openName, ...openWords } = describeDashboardBodyMapCard({
        ...input,
        opensBodyMap: true,
      });

      expect(closedWords).toStrictEqual(openWords);
      expect(openName).toBe(`${closedName} Open the body map`);
    });
  });
});

describe("describeWebListCaption", () => {
  it.each([
    [{ scale: "heat", moreAtRest: 10 }, "Hottest first · 10 more at rest"],
    [
      { scale: "volume", moreUnder: 3, notTargeted: 7 },
      "Most sets first · 3 more under, 7 not targeted",
    ],
    [
      { scale: "gap", moreOnPlan: 3, notInPlan: 7 },
      "Furthest behind first · 3 more on plan, 7 not in plan",
    ],
  ] as const)("should write %j as the web board does", (input, caption) => {
    expect(describeWebListCaption(input)).toBe(caption);
  });

  it("should leave out a count of 0 and the dot when both are 0", () => {
    expect(describeWebListCaption({ scale: "heat", moreAtRest: 0 })).toBe("Hottest first");
    expect(describeWebListCaption({ scale: "volume", moreUnder: 0, notTargeted: 7 })).toBe(
      "Most sets first · 7 not targeted",
    );
    expect(describeWebListCaption({ scale: "gap", moreOnPlan: 3, notInPlan: 0 })).toBe(
      "Furthest behind first · 3 more on plan",
    );
    expect(describeWebListCaption({ scale: "gap", moreOnPlan: 0, notInPlan: 0 })).toBe(
      "Furthest behind first",
    );
  });
});

describe("describeVolumeListRow, the web volume board", () => {
  const row = (weeklySets: number, status: "productive" | "maintaining", view = "projected") =>
    describeVolumeListRow({
      muscle: "triceps",
      weeklySets,
      status,
      view: view === "projected" ? "projected" : "actual",
      weekEnd: "2026-10-18",
    });

  it("should write the triceps at 15 sets by Sunday as the board does", () => {
    expect(row(15, "productive")).toStrictEqual({
      name: "Triceps",
      valueText: "15",
      status: "Productive",
      accessibleName: "Triceps, 15 sets by Sunday, productive, open details",
    });
  });

  it("should write a fractional count as it is", () => {
    expect(row(9.6, "maintaining")).toMatchObject({
      valueText: "9.6",
      accessibleName: "Triceps, 9.6 sets by Sunday, maintaining, open details",
    });
  });

  it("should write the Actual view as the week so far, and name a status with an underscore in words", () => {
    expect(
      describeVolumeListRow({
        muscle: "abs",
        weeklySets: 0,
        status: "not_targeted",
        view: "actual",
        weekEnd: "2026-10-18",
      }),
    ).toStrictEqual({
      name: "Abs",
      valueText: "0",
      status: "Not targeted",
      accessibleName: "Abs, 0 sets so far this week, not targeted, open details",
    });
  });
});

describe("describeGapListRow, the web gap board", () => {
  it("should write the triceps behind by 7.5 as the board does, with the true minus sign", () => {
    expect(
      describeGapListRow({ muscle: "triceps", done: 7.5, planned: 15, status: "behind" }),
    ).toStrictEqual({
      name: "Triceps",
      valueText: "\u22127.5",
      status: "Behind · 7.5 of 15 sets",
      accessibleName: "Triceps, 7.5 of 15 planned sets, behind, open details",
    });
  });

  it("should write a muscle exactly on plan with a gap of 0", () => {
    expect(
      describeGapListRow({ muscle: "lats", done: 11, planned: 11, status: "on_plan" }),
    ).toStrictEqual({
      name: "Lats",
      valueText: "0",
      status: "On plan · 11 of 11 sets",
      accessibleName: "Lats, 11 of 11 planned sets, on plan, open details",
    });
  });

  it("should write a muscle ahead of plan with a plus sign, and one planned set in the singular", () => {
    expect(
      describeGapListRow({ muscle: "lats", done: 3.5, planned: 1, status: "ahead" }),
    ).toMatchObject({
      valueText: "+2.5",
      status: "Ahead · 3.5 of 1 set",
      accessibleName: "Lats, 3.5 of 1 planned set, ahead, open details",
    });
  });
});

describe("the figure setting", () => {
  it("should write the row value as the option alone, under the row title Figure", () => {
    expect(describeFigureRowValue("female")).toBe("Female");
    expect(describeFigureRowValue("male")).toBe("Male");
  });
});

describe("the small date and count words", () => {
  it("should write a short date, a weekday name and the week range", () => {
    expect(describeShortDate("2026-10-12")).toBe("Mon 12 Oct");
    expect(describeWeekdayName("2026-10-12")).toBe("Monday");
    expect(describeWeekRange("2026-10-12")).toBe("Mon 12 to Sun 18 Oct");
  });

  it("should name both months when the week crosses one", () => {
    expect(describeWeekRange("2026-10-26")).toBe("Mon 26 Oct to Sun 1 Nov");
  });

  it("should write set counts with whole numbers and up to two decimals, and no drift", () => {
    expect(formatSetCount(11)).toBe("11");
    expect(formatSetCount(5.5)).toBe("5.5");
    expect(formatSetCount(7.75)).toBe("7.75");
    expect(formatSetCount(0.1 + 0.2)).toBe("0.3");
  });

  it("should write set in the singular only for exactly one", () => {
    expect(describeSets(1)).toBe("1 set");
    expect(describeSets(0)).toBe("0 sets");
    expect(describeSets(1.5)).toBe("1.5 sets");
    expect(describeSets(16)).toBe("16 sets");
  });
});
