import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import { samples } from "./samples/history";
import {
  describeDeleteSessionBody,
  describeEditSetSheet,
  describeHistoryRow,
  describeHistorySessionName,
  describeHistorySet,
  describeHistoryWeek,
  describeLoadFieldLabel,
  describeSessionExerciseNote,
  describeSessionStats,
  describeSessionWhen,
  HISTORY_DELETE_SESSION,
  HISTORY_EDIT_SET,
  HISTORY_EMPTY,
  HISTORY_ERROR,
  HISTORY_LOADING_NAME,
  HISTORY_SCREEN,
  HISTORY_SESSION_DETAIL,
} from "../../src/copy";
import * as historyCopy from "../../src/copy/history";

import type { HistorySetInput } from "../../src/copy";
import type { SessionSummary } from "../../src/training";

/*
 * The golden Tuesday Pull of KEY-353 and the other golden sessions, as `summariseSession` gives them
 * (the figures are asserted in `historySummary.golden.test.ts`), rendered as the boards `history · *` draw
 * them. Where the canvas and core differ, the test follows core: the golden Thursday is open, so it has
 * no minutes.
 */
const WIDE_GRIP_LAT_PULLDOWN = "00000000-0000-4000-8000-0000000000a8";

const pullSummary: SessionSummary = {
  durationMinutes: 51,
  workingSets: 17,
  warmupSets: 1,
  topMuscles: ["lats", "biceps", "traps_mid"],
  titleSource: "Pull",
  planComparison: {
    setsOverPlan: [{ exerciseId: WIDE_GRIP_LAT_PULLDOWN, setsOver: 2 }],
    exercisesNotLogged: [],
  },
};

const pushSummary: SessionSummary = {
  durationMinutes: 48,
  workingSets: 16,
  warmupSets: 1,
  topMuscles: ["triceps", "delt_front", "delt_side"],
  titleSource: "Push",
  planComparison: { setsOverPlan: [], exercisesNotLogged: [] },
};

const legsSummary: SessionSummary = {
  durationMinutes: null,
  workingSets: 8,
  warmupSets: 2,
  topMuscles: ["hamstrings", "quads", "glute_max"],
  titleSource: "Legs",
  planComparison: {
    setsOverPlan: [],
    exercisesNotLogged: ["seated-leg-curl", "standing-calf-raises"],
  },
};

describe("the History screen's fixed words", () => {
  it("should name the screen and its back link as the history · list board does, and the action no board draws", () => {
    expect(HISTORY_SCREEN).toStrictEqual({
      title: "History",
      backLabel: "Back to Train",
      loadEarlierAction: "Load earlier weeks",
    });
  });

  it("should name the session detail's controls and cards as the history · session-detail board does", () => {
    expect(HISTORY_SESSION_DETAIL).toStrictEqual({
      backLabel: "Back to History",
      moreLabel: "More for this session",
      deleteSessionAction: "Delete session",
      timeLabel: "Time",
      setsLabel: "Sets",
      planLabel: "Plan",
      setsListName: "Sets",
    });
  });

  it("should say what the empty board says", () => {
    expect(HISTORY_EMPTY).toStrictEqual({
      title: "No sessions yet",
      body: "Every session you log shows here, newest first, with its sets.",
      action: "Start a session",
    });
  });

  it("should say what the loading board names for a screen reader", () => {
    expect(HISTORY_LOADING_NAME).toBe("Loading your history");
  });

  it("should say what the error board says, with no value in it", () => {
    expect(HISTORY_ERROR).toStrictEqual({
      title: "Your history did not load",
      body: "Your sessions are safe. Check your connection, then try again.",
      action: "Try again",
    });
  });
});

describe("describeHistoryWeek", () => {
  it("should read the golden week as the history · list board draws it", () => {
    expect(
      describeHistoryWeek(
        { weekStart: "2026-10-12", sessionCount: 3, workingSetTotal: 41 },
        "2026-10-12",
      ),
    ).toStrictEqual({ name: "This week · Mon 12 to Sun 18 Oct", total: "3 sessions · 41 sets" });
  });

  it("should call the week before this one last week", () => {
    expect(
      describeHistoryWeek(
        { weekStart: "2026-10-05", sessionCount: 4, workingSetTotal: 63 },
        "2026-10-12",
      ),
    ).toStrictEqual({ name: "Last week · Mon 5 to Sun 11 Oct", total: "4 sessions · 63 sets" });
  });

  it("should name an older week by its days alone, with the month on both ends when they differ", () => {
    expect(
      describeHistoryWeek(
        { weekStart: "2026-09-28", sessionCount: 2, workingSetTotal: 30 },
        "2026-10-12",
      ).name,
    ).toBe("Mon 28 Sep to Sun 4 Oct");
  });

  it("should use the singular for one session and one set", () => {
    expect(
      describeHistoryWeek(
        { weekStart: "2026-10-12", sessionCount: 1, workingSetTotal: 1 },
        "2026-10-12",
      ).total,
    ).toBe("1 session · 1 set");
  });

  it("should use the plural for no sessions", () => {
    expect(
      describeHistoryWeek(
        { weekStart: "2026-10-12", sessionCount: 0, workingSetTotal: 0 },
        "2026-10-12",
      ).total,
    ).toBe("0 sessions · 0 sets");
  });
});

describe("describeHistorySessionName", () => {
  it("should be the routine day's name", () => {
    expect(describeHistorySessionName("Pull")).toBe("Pull");
  });

  it("should be Session for a session that follows no routine day, as the Train home names it", () => {
    expect(describeHistorySessionName(null)).toBe("Session");
  });
});

describe("describeHistoryRow", () => {
  it("should read the golden Tuesday Pull as the history · list board draws it", () => {
    expect(describeHistoryRow({ localDate: "2026-10-13", summary: pullSummary })).toStrictEqual({
      weekday: "Tue",
      dayOfMonth: "13",
      name: "Pull",
      meta: "51 min · 17 sets",
      muscles: "Lats · biceps · mid traps",
      accessibleName: "Pull, Tue 13 October, 51 minutes · 17 sets, open session",
    });
  });

  it("should read the golden Monday Push as the board draws it", () => {
    const row = describeHistoryRow({ localDate: "2026-10-12", summary: pushSummary });

    expect(row.weekday).toBe("Mon");
    expect(row.dayOfMonth).toBe("12");
    expect(row.meta).toBe("48 min · 16 sets");
    expect(row.muscles).toBe("Triceps · front delts · side delts");
  });

  it("should leave the minutes out of an open session, which has none yet", () => {
    const row = describeHistoryRow({ localDate: "2026-10-15", summary: legsSummary });

    expect(row.meta).toBe("8 sets");
    expect(row.muscles).toBe("Hamstrings · quads · glutes");
    expect(row.accessibleName).toBe("Legs, Thu 15 October, 8 sets, in progress, open session");
  });

  it("should use the singular for one minute and one set", () => {
    const row = describeHistoryRow({
      localDate: "2026-10-13",
      summary: { ...pullSummary, durationMinutes: 1, workingSets: 1 },
    });

    expect(row.meta).toBe("1 min · 1 set");
    expect(row.accessibleName).toBe("Pull, Tue 13 October, 1 minute · 1 set, open session");
  });

  it("should name a session that follows no routine day Session and leave the muscles line empty when no muscle worked", () => {
    const row = describeHistoryRow({
      localDate: "2026-10-13",
      summary: { ...pullSummary, titleSource: null, topMuscles: [] },
    });

    expect(row.name).toBe("Session");
    expect(row.muscles).toBeNull();
  });

  it("should name one muscle on the line when only one worked", () => {
    expect(
      describeHistoryRow({
        localDate: "2026-10-13",
        summary: { ...pullSummary, topMuscles: ["neck"] },
      }).muscles,
    ).toBe("Neck");
  });
});

describe("describeSessionWhen", () => {
  it("should read the golden Tuesday Pull as the history · session-detail board draws it", () => {
    expect(
      describeSessionWhen({
        localDate: "2026-10-13",
        startedAt: "2026-10-13T18:00:00+01:00",
        endedAt: "2026-10-13T18:51:00+01:00",
        tz: "Europe/London",
      }),
    ).toBe("Tuesday 13 October · 18:00 to 18:51");
  });

  it("should give the start alone for a session that is still open", () => {
    expect(
      describeSessionWhen({
        localDate: "2026-10-15",
        startedAt: "2026-10-15T18:30:00+01:00",
        endedAt: null,
        tz: "Europe/London",
      }),
    ).toBe("Thursday 15 October · 18:30");
  });

  it("should write the times in the zone it is given", () => {
    expect(
      describeSessionWhen({
        localDate: "2026-10-13",
        startedAt: "2026-10-13T17:00:00Z",
        endedAt: "2026-10-13T17:51:00Z",
        tz: "Europe/London",
      }),
    ).toBe("Tuesday 13 October · 18:00 to 18:51");
  });
});

describe("describeSessionStats", () => {
  it("should read the golden Tuesday Pull as the history · session-detail board draws it", () => {
    expect(describeSessionStats(pullSummary)).toStrictEqual({
      time: { label: "Time", value: "51 min", note: null },
      sets: { label: "Sets", value: "17", note: "and 1 warm-up" },
      plan: { label: "Plan", value: "+2", note: "sets over" },
    });
  });

  it("should use the singular for one set over the plan", () => {
    expect(
      describeSessionStats({
        ...pullSummary,
        planComparison: {
          setsOverPlan: [{ exerciseId: WIDE_GRIP_LAT_PULLDOWN, setsOver: 1 }],
          exercisesNotLogged: [],
        },
      }).plan,
    ).toStrictEqual({ label: "Plan", value: "+1", note: "set over" });
  });

  it("should add up the sets over the plan across exercises", () => {
    expect(
      describeSessionStats({
        ...pullSummary,
        planComparison: {
          setsOverPlan: [
            { exerciseId: "a", setsOver: 2 },
            { exerciseId: "b", setsOver: 1 },
          ],
          exercisesNotLogged: [],
        },
      }).plan?.value,
    ).toBe("+3");
  });

  it("should say on plan when every planned exercise was logged and none went over", () => {
    expect(describeSessionStats(pushSummary).plan).toStrictEqual({
      label: "Plan",
      value: "On plan",
      note: null,
    });
  });

  it("should say under when planned exercises were not logged, and count them", () => {
    expect(describeSessionStats(legsSummary).plan).toStrictEqual({
      label: "Plan",
      value: "Under",
      note: "2 exercises not logged",
    });
  });

  it("should use the singular for one exercise not logged", () => {
    expect(
      describeSessionStats({
        ...legsSummary,
        planComparison: { setsOverPlan: [], exercisesNotLogged: ["seated-leg-curl"] },
      }).plan?.note,
    ).toBe("1 exercise not logged");
  });

  it("should show the sets over when a session is both over on one exercise and short on another", () => {
    expect(
      describeSessionStats({
        ...pullSummary,
        planComparison: {
          setsOverPlan: [{ exerciseId: WIDE_GRIP_LAT_PULLDOWN, setsOver: 2 }],
          exercisesNotLogged: ["face-pull"],
        },
      }).plan,
    ).toStrictEqual({ label: "Plan", value: "+2", note: "sets over" });
  });

  it("should have no Plan card for a session that follows no routine day", () => {
    expect(describeSessionStats({ ...pullSummary, planComparison: null }).plan).toBeNull();
  });

  it("should say in progress where an open session has no minutes", () => {
    expect(describeSessionStats(legsSummary).time).toStrictEqual({
      label: "Time",
      value: "In progress",
      note: null,
    });
  });

  it("should pluralise the warm-ups and leave the note out when there are none", () => {
    expect(describeSessionStats(legsSummary).sets.note).toBe("and 2 warm-ups");
    expect(describeSessionStats({ ...pullSummary, warmupSets: 0 }).sets.note).toBeNull();
  });
});

describe("describeSessionExerciseNote", () => {
  it("should say Bodyweight for an exercise done without a load, as the board does for pullups", () => {
    expect(describeSessionExerciseNote({ isBodyweight: true, setsOver: 0 })).toBe("Bodyweight");
  });

  it("should say how many more sets than planned, as the board does for the lat pulldown", () => {
    expect(describeSessionExerciseNote({ isBodyweight: false, setsOver: 2 })).toBe(
      "2 more than planned",
    );
    expect(describeSessionExerciseNote({ isBodyweight: false, setsOver: 1 })).toBe(
      "1 more than planned",
    );
  });

  it("should say both when an exercise is bodyweight and over the plan", () => {
    expect(describeSessionExerciseNote({ isBodyweight: true, setsOver: 1 })).toBe(
      "Bodyweight · 1 more than planned",
    );
  });

  it("should have no note otherwise", () => {
    expect(describeSessionExerciseNote({ isBodyweight: false, setsOver: 0 })).toBeNull();
  });
});

describe("describeHistorySet", () => {
  const working: HistorySetInput = {
    setType: "working",
    setNumber: 1,
    loadKg: null,
    reps: 10,
    rir: 2,
    isNotInPlan: false,
    unit: "kg",
  };

  it("should read a bodyweight working set as the board draws the pullups", () => {
    expect(describeHistorySet(working)).toStrictEqual({
      label: "1",
      what: "10 reps",
      rir: "RIR 2",
      accessibleName: "Set 1, 10 reps, RIR 2, edit",
    });
  });

  it("should read a warm-up with no RIR as the board draws the row's warm-up", () => {
    expect(
      describeHistorySet({ ...working, setType: "warmup", loadKg: 40, reps: 10, rir: null }),
    ).toStrictEqual({
      label: "W",
      what: "40 kg × 10",
      rir: "No RIR",
      accessibleName: "Warm-up set, 40 kg by 10, no RIR, edit",
    });
  });

  it("should say a set is not in the plan on its accessible name", () => {
    expect(
      describeHistorySet({
        ...working,
        setNumber: 4,
        loadKg: 60,
        reps: 10,
        rir: 1,
        isNotInPlan: true,
      }),
    ).toStrictEqual({
      label: "4",
      what: "60 kg × 10",
      rir: "RIR 1",
      accessibleName: "Set 4, 60 kg by 10, RIR 1, not in the plan, edit",
    });
  });

  it("should mark drop and failure sets as the session set types board does", () => {
    expect(describeHistorySet({ ...working, setType: "drop", loadKg: 50, reps: 12 })).toMatchObject(
      { label: "D", accessibleName: "Drop set, 50 kg by 12, RIR 2, edit" },
    );
    expect(
      describeHistorySet({ ...working, setType: "failure", loadKg: 50, reps: 6 }),
    ).toMatchObject({ label: "F", accessibleName: "Failure set, 50 kg by 6, RIR 2, edit" });
  });

  it("should show the load in the unit the person trains in", () => {
    expect(describeHistorySet({ ...working, loadKg: 31.75, unit: "lb" }).what).toBe("70 lb × 10");
  });

  it("should keep a decimal load as typed", () => {
    expect(describeHistorySet({ ...working, loadKg: 2.5 }).what).toBe("2.5 kg × 10");
  });

  it("should use the singular for one rep", () => {
    expect(describeHistorySet({ ...working, reps: 1 }).what).toBe("1 rep");
  });
});

describe("the edit set sheet", () => {
  it("should read the barbell curl as the history · edit-set board draws it, with the name as the catalogue stores it", () => {
    expect(
      describeEditSetSheet({
        exerciseName: "Barbell Curl",
        setType: "working",
        setNumber: 3,
        performedAt: "2026-10-13T18:51:00+01:00",
        tz: "Europe/London",
      }),
    ).toStrictEqual({
      accessibleName: "Edit Barbell Curl, set 3",
      title: "Barbell Curl",
      subtitle: "Set 3 · Tue 13 Oct, 18:51",
    });
  });

  it("should name a warm-up by its type, since it has no number", () => {
    expect(
      describeEditSetSheet({
        exerciseName: "Bent Over Barbell Row",
        setType: "warmup",
        setNumber: 1,
        performedAt: "2026-10-13T18:07:00+01:00",
        tz: "Europe/London",
      }),
    ).toStrictEqual({
      accessibleName: "Edit Bent Over Barbell Row, warm-up set",
      title: "Bent Over Barbell Row",
      subtitle: "Warm-up set · Tue 13 Oct, 18:07",
    });
  });

  it("should leave an exercise name as the catalogue stores it, never re-cased", () => {
    const sheet = describeEditSetSheet({
      exerciseName: "Wide-Grip Lat Pulldown",
      setType: "working",
      setNumber: 2,
      performedAt: "2026-10-13T18:30:00+01:00",
      tz: "Europe/London",
    });

    expect(sheet.title).toBe("Wide-Grip Lat Pulldown");
    expect(sheet.accessibleName).toBe("Edit Wide-Grip Lat Pulldown, set 2");
  });

  it("should name the load field for the unit", () => {
    expect(describeLoadFieldLabel("kg")).toBe("Load, kg");
    expect(describeLoadFieldLabel("lb")).toBe("Load, lb");
  });

  it("should say what the board says in the sheet's fixed words", () => {
    expect(HISTORY_EDIT_SET).toStrictEqual({
      repsLabel: "Reps",
      rirLabel: "RIR, reps in reserve",
      rirOptions: ["0", "1", "2", "3", "4", "5", "6+"],
      noRirHint: "Not entered, so this working set counts as hard.",
      effectHint: "Changing a past set updates that day's heat and the week's sets.",
      deleteSetAction: "Delete set",
      saveAction: "Save changes",
    });
  });
});

describe("the delete session confirmation", () => {
  it("should name the buttons and the title", () => {
    expect(HISTORY_DELETE_SESSION).toStrictEqual({
      title: "Delete this session?",
      confirmAction: "Delete session",
      cancelAction: "Keep it",
    });
  });

  it("should name the sets, the session and the day, as KEY-414 proposes", () => {
    expect(
      describeDeleteSessionBody({ setCount: 17, dayName: "Pull", localDate: "2026-10-13" }),
    ).toBe(
      "The 17 sets in Pull on Tuesday 13 October are removed from your history and your body map. This cannot be undone.",
    );
  });

  it("should agree with one set", () => {
    expect(
      describeDeleteSessionBody({ setCount: 1, dayName: "Pull", localDate: "2026-10-13" }),
    ).toBe(
      "The set in Pull on Tuesday 13 October is removed from your history and your body map. This cannot be undone.",
    );
  });

  it("should call a session that follows no routine day your session", () => {
    expect(describeDeleteSessionBody({ setCount: 3, dayName: null, localDate: "2026-10-13" })).toBe(
      "The 3 sets in your session on Tuesday 13 October are removed from your history and your body map. This cannot be undone.",
    );
  });

  it("should name the session alone when it holds no sets", () => {
    expect(
      describeDeleteSessionBody({ setCount: 0, dayName: "Pull", localDate: "2026-10-13" }),
    ).toBe(
      "The session on Tuesday 13 October is removed from your history and your body map. This cannot be undone.",
    );
  });
});

describe("the voice of the History copy", () => {
  const sentences = [
    ...Object.values(historyCopy).flatMap(collectStrings),
    ...Object.values(samples).flatMap((call) => call()),
  ];

  it("should find a good number of sentences to check", () => {
    expect(sentences.length).toBeGreaterThan(40);
  });

  it("should use no em dash, no semicolon and no exclamation mark", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain(";");
      expect(sentence).not.toContain("!");
    }
  });
});
