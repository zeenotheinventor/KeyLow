import { describe, expect, it } from "vitest";

import { benchPress, heatSet, repeat } from "./heatSets";
import { MISSED_MERGED_REMINDER_VARIANTS, TRAINING_REMINDER_VARIANTS } from "../../src/copy";
import {
  CHECKIN_STREAK_DAYS,
  MISSED_LOOKBACK_DAYS,
  MISSED_REMINDER_TIME,
  planTrainingReminders,
} from "../../src/training";

import type { TrainingReminderInput, TrainingReminderSession } from "../../src/training";

/*
 * The missed day and check-in rules of KEY-813. Dates are October 2026: Monday 19, Tuesday 20, Wednesday 21,
 * Thursday 22, Friday 23, Saturday 24, Sunday 25 (London's clocks go back at 01:00 UTC that day) and Monday
 * 26. London is on BST (UTC+1) until then, so 09:00 local is 08:00 UTC before the change and 09:00 UTC after.
 */

const LONDON = "Europe/London";
const MONDAY = 0;
const TUESDAY = 1;
const WEDNESDAY = 2;
const THURSDAY = 3;
const FRIDAY = 4;
const SATURDAY = 5;
const SUNDAY = 6;

const onlyMissedAndCheckin = {
  trainEnabled: false,
  progressEnabled: false,
  easeEnabled: false,
  trainTime: "17:30",
  missedEnabled: true,
  checkinEnabled: true,
};

const chest = [{ muscle_id: "chest_lower", role: "primary" }] as const;

// Active from Monday 19 October unless a test says otherwise, so the weeks before it never read missed.
const routineOf = (weekdays: readonly number[], activeFrom = "2026-10-19") => ({
  days: weekdays.map((weekday) => ({
    id: `day-${weekday}`,
    weekday,
    exercises: [{ muscles: chest }],
  })),
  activeFrom,
});

const finishedOn = (
  localDate: string,
  routineDayId: string | null = null,
): TrainingReminderSession => ({
  id: `session-${localDate}-${routineDayId ?? "own"}`,
  local_date: localDate,
  started_at: `${localDate}T10:00:00Z`,
  ended_at: `${localDate}T11:00:00Z`,
  routine_day_id: routineDayId,
  deleted_at: null,
});

const planFor = (now: string, overrides: Partial<TrainingReminderInput> = {}) =>
  planTrainingReminders({
    now,
    timeZone: LONDON,
    settings: onlyMissedAndCheckin,
    plan: routineOf([TUESDAY]),
    sessions: [],
    heatSets: [],
    weeklyGain: false,
    lastVariantIds: { train: null, progress: null, ease: null, missed: null, checkin: null },
    lastCheckInAt: null,
    ...overrides,
  });

// The week after the scenario is projected as well, and its first days would add lines to every row. Rows
// look at the scenario's own week unless they say where to stop, and one test below reads the whole window.
const END_OF_SCENARIO_WEEK = "2026-10-26T00:00:00.000Z";

const summary = (
  now: string,
  overrides: Partial<TrainingReminderInput> = {},
  until = END_OF_SCENARIO_WEEK,
) =>
  planFor(now, overrides)
    .filter(({ fireAt }) => fireAt < until)
    .map(({ type, fireAt }) => `${type} ${fireAt}`);

describe("the constants", () => {
  it("should pin the quiet hour, the streak and the lookback", () => {
    expect(MISSED_REMINDER_TIME).toEqual({ hour: 9, minute: 0 });
    expect(CHECKIN_STREAK_DAYS).toBe(3);
    expect(MISSED_LOOKBACK_DAYS).toBe(21);
  });
});

describe("a missed day", () => {
  it.each([
    {
      name: "fires at 09:00 the next day, projected from before the day is over",
      now: "2026-10-20T12:00:00Z",
      plan: routineOf([TUESDAY]),
      expected: ["missed 2026-10-21T08:00:00.000Z"],
    },
    {
      name: "fires at 09:00 the morning after a Tuesday when Wednesday is a rest day",
      now: "2026-10-21T06:00:00Z",
      plan: routineOf([TUESDAY]),
      expected: ["missed 2026-10-21T08:00:00.000Z"],
    },
    {
      name: "is not sent once 09:00 has passed",
      now: "2026-10-21T08:30:00Z",
      plan: routineOf([TUESDAY]),
      expected: [],
    },
    {
      name: "follows the clocks going back, as 09:00 on the Monday after the change",
      now: "2026-10-25T06:00:00Z",
      plan: routineOf([SUNDAY]),
      until: "2026-10-27T00:00:00.000Z",
      expected: ["missed 2026-10-26T09:00:00.000Z"],
    },
    {
      name: "never counts a day before the routine was active",
      now: "2026-10-21T06:00:00Z",
      plan: routineOf([TUESDAY], "2026-10-21"),
      expected: [],
    },
    {
      name: "counts the day the routine became active",
      now: "2026-10-21T06:00:00Z",
      plan: routineOf([TUESDAY], "2026-10-20"),
      expected: ["missed 2026-10-21T08:00:00.000Z"],
    },
    {
      name: "plans nothing without a routine",
      now: "2026-10-21T06:00:00Z",
      plan: null,
      expected: [],
    },
  ])("$name", ({ now, plan, expected, until }) => {
    expect(summary(now, { plan }, until)).toEqual(expected);
  });

  it("should be projected for a future planned day, and dropped on re-plan once a session is finished", () => {
    const friday = routineOf([FRIDAY]);

    expect(summary("2026-10-23T12:00:00Z", { plan: friday })).toEqual([
      "missed 2026-10-24T08:00:00.000Z",
    ]);
    expect(
      summary("2026-10-23T12:00:00Z", { plan: friday, sessions: [finishedOn("2026-10-23")] }),
    ).toEqual([]);
  });

  it("should not count a session that is deleted or on another day", () => {
    const others = [
      { ...finishedOn("2026-10-20"), deleted_at: "2026-10-20T12:00:00Z" },
      finishedOn("2026-10-19"),
    ];

    expect(summary("2026-10-21T06:00:00Z", { sessions: others })).toEqual([
      "missed 2026-10-21T08:00:00.000Z",
    ]);
  });

  it("should leave a day alone while a session of it is still open, which is not missed", () => {
    const open = [{ ...finishedOn("2026-10-20"), ended_at: null }];

    expect(summary("2026-10-21T06:00:00Z", { sessions: open })).toEqual([]);
  });

  it("should send nothing on a day a session was already finished", () => {
    expect(summary("2026-10-21T06:00:00Z", { sessions: [finishedOn("2026-10-21")] })).toEqual([]);
  });

  it("should leave out a day made up late (KEY-531)", () => {
    // Tuesday's day is done on Wednesday, so Tuesday reads logged and Wednesday reads missed as if it
    // were planned. With only Tuesday planned, Wednesday is rest: nothing is missed on Thursday.
    const madeUp = [finishedOn("2026-10-21", "day-1")];

    expect(summary("2026-10-22T06:00:00Z", { sessions: madeUp })).toEqual([]);
  });

  it("should be off when its switch is off or left out, whatever the days", () => {
    const withoutSwitches = {
      trainEnabled: false,
      progressEnabled: false,
      easeEnabled: false,
      trainTime: "17:30",
    };

    expect(summary("2026-10-21T06:00:00Z", { settings: withoutSwitches })).toEqual([]);
    expect(
      summary("2026-10-21T06:00:00Z", {
        settings: { ...onlyMissedAndCheckin, missedEnabled: false, checkinEnabled: false },
      }),
    ).toEqual([]);
  });
});

describe("a missed day next to a train day or an easy day", () => {
  const trainAndMissed = { ...onlyMissedAndCheckin, trainEnabled: true };

  it("should merge into one notification at the train time when the next day is a train day", () => {
    const planned = planFor("2026-10-20T18:00:00Z", {
      settings: trainAndMissed,
      plan: routineOf([TUESDAY, WEDNESDAY]),
    }).filter(({ fireAt }) => fireAt < END_OF_SCENARIO_WEEK);

    // Wednesday is then missed too, in the plan as it stands, which gives Thursday's at 09:00.
    expect(planned.map(({ type, fireAt }) => `${type} ${fireAt}`)).toEqual([
      "missed 2026-10-21T16:30:00.000Z",
      "missed 2026-10-22T08:00:00.000Z",
    ]);
    expect(planned[0]?.variantId).toMatch(/^missed-merged-\d$/);
    expect(planned[0]?.title).toBe("A fresh start");
  });

  it("should fire at 09:00 with the plain words when the next day is a train day but train is off", () => {
    const planned = planFor("2026-10-20T18:00:00Z", {
      plan: routineOf([TUESDAY, WEDNESDAY]),
    }).filter(({ fireAt }) => fireAt < END_OF_SCENARIO_WEEK);

    expect(planned.map(({ type, fireAt }) => `${type} ${fireAt}`)).toEqual([
      "missed 2026-10-21T08:00:00.000Z",
      "missed 2026-10-22T08:00:00.000Z",
    ]);
    expect(planned[0]?.variantId).not.toContain("merged");
  });

  it("should fire at 09:00 on a rest day while train is on, and leave Time to train alone", () => {
    expect(
      summary("2026-10-20T06:00:00Z", { settings: trainAndMissed, plan: routineOf([TUESDAY]) }),
    ).toEqual(["train 2026-10-20T16:30:00.000Z", "missed 2026-10-21T08:00:00.000Z"]);
  });

  it("should send no missed reminder when the next day gets Take it easy", () => {
    const sets = repeat(40, heatSet(benchPress, { performed_at: "2026-10-20T17:00:00Z" }));
    const settings = { ...trainAndMissed, easeEnabled: true };

    expect(
      summary("2026-10-20T18:00:00Z", {
        settings,
        plan: routineOf([TUESDAY, WEDNESDAY]),
        heatSets: sets,
      }),
    ).toEqual(["ease 2026-10-21T07:00:00.000Z", "missed 2026-10-22T08:00:00.000Z"]);
  });

  it("should send at most one of train, ease, missed and check-in on any day", () => {
    const settings = { ...trainAndMissed, easeEnabled: true };
    const everyDay = routineOf([0, 1, 2, 3, 4, 5, 6]);
    const planned = planFor("2026-10-22T06:00:00Z", { settings, plan: everyDay });
    const days = planned.map(({ fireAt }) => fireAt.slice(0, 10));

    expect(new Set(days).size).toBe(days.length);
  });
});

describe("the several-missed-days check-in", () => {
  it.each([
    {
      name: "replaces the missed reminder the morning after the third missed day, once",
      now: "2026-10-22T06:00:00Z",
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY]),
      expected: ["checkin 2026-10-22T08:00:00.000Z"],
    },
    {
      name: "sends nothing extra for a fourth miss once the check-in was delivered",
      now: "2026-10-22T20:00:00Z",
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY, THURSDAY]),
      lastCheckInAt: "2026-10-22T08:00:00Z",
      expected: [],
    },
    {
      name: "sends the check-in on the fourth miss morning when the third one never went out",
      now: "2026-10-22T20:00:00Z",
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY, THURSDAY]),
      expected: ["checkin 2026-10-23T08:00:00.000Z"],
    },
    {
      name: "is broken by a session on a rest day, so someone who is training is not asked",
      now: "2026-10-24T05:00:00Z",
      plan: routineOf([MONDAY, WEDNESDAY, FRIDAY]),
      sessions: [finishedOn("2026-10-20")],
      expected: ["missed 2026-10-24T08:00:00.000Z"],
    },
    {
      name: "does not ask again in a long absence while the last check-in is inside the lookback",
      now: "2026-10-22T06:00:00Z",
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY], "2026-09-14"),
      lastCheckInAt: "2026-10-01T08:00:00Z",
      expected: [],
    },
    {
      name: "asks once for a long absence that has no check-in inside the lookback",
      now: "2026-10-22T06:00:00Z",
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY], "2026-09-14"),
      lastCheckInAt: "2026-09-30T08:00:00Z",
      expected: ["checkin 2026-10-22T08:00:00.000Z"],
    },
    {
      name: "sends only a missed reminder for two missed days",
      now: "2026-10-21T06:00:00Z",
      plan: routineOf([MONDAY, TUESDAY]),
      expected: ["missed 2026-10-21T08:00:00.000Z"],
    },
    {
      name: "is not broken by the rest days between the missed days",
      now: "2026-10-24T05:00:00Z",
      plan: routineOf([MONDAY, WEDNESDAY, FRIDAY]),
      expected: ["checkin 2026-10-24T08:00:00.000Z"],
    },
    {
      name: "is broken by a finished session on a planned day",
      now: "2026-10-23T06:00:00Z",
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY, THURSDAY]),
      sessions: [finishedOn("2026-10-20")],
      expected: ["missed 2026-10-23T08:00:00.000Z"],
    },
    {
      name: "is broken by a day made up late, though it reads logged only through the make-up",
      now: "2026-10-22T06:00:00Z",
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY]),
      sessions: [finishedOn("2026-10-21", "day-1")],
      expected: ["missed 2026-10-22T08:00:00.000Z"],
    },
    {
      name: "does not count the days before the routine was active",
      now: "2026-10-22T06:00:00Z",
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY], "2026-10-20"),
      expected: ["missed 2026-10-22T08:00:00.000Z"],
    },
    {
      name: "follows a streak over the end of a week, and over the change of clocks",
      now: "2026-10-27T06:00:00Z",
      plan: routineOf([SATURDAY, SUNDAY, MONDAY]),
      until: "2026-10-28T00:00:00.000Z",
      expected: ["checkin 2026-10-27T09:00:00.000Z"],
    },
  ])("$name", ({ now, plan, expected, sessions, until, lastCheckInAt }) => {
    expect(
      summary(now, { plan, sessions: sessions ?? [], lastCheckInAt: lastCheckInAt ?? null }, until),
    ).toEqual(expected);
  });

  it("should plan the check-in once for the whole window, not again for the misses that follow it", () => {
    // Monday to Wednesday are missed, and next Monday is projected missed too, which extends the same streak.
    expect(
      planFor("2026-10-22T06:00:00Z", { plan: routineOf([MONDAY, TUESDAY, WEDNESDAY]) }),
    ).toEqual([expect.objectContaining({ type: "checkin", fireAt: "2026-10-22T08:00:00.000Z" })]);
  });

  it("should not repeat after a check-in that was delivered, until a new streak begins", () => {
    const plan = routineOf([MONDAY, TUESDAY, WEDNESDAY, THURSDAY]);

    expect(summary("2026-10-23T06:00:00Z", { plan })).toEqual(["checkin 2026-10-23T08:00:00.000Z"]);
    expect(
      summary("2026-10-23T06:00:00Z", { plan, lastCheckInAt: "2026-10-22T08:00:00Z" }),
    ).toEqual([]);
  });

  it("should treat a check-in on the first missed day, or later, as belonging to the streak", () => {
    const plan = routineOf([MONDAY, TUESDAY, WEDNESDAY]);
    const now = "2026-10-22T06:00:00Z";

    expect(summary(now, { plan, lastCheckInAt: "2026-10-19T08:00:00Z" })).toEqual([]);
    expect(summary(now, { plan, lastCheckInAt: "2026-10-18T08:00:00Z" })).toEqual([
      "checkin 2026-10-22T08:00:00.000Z",
    ]);
  });

  it("should compare the check-in with the streak by the person's own calendar day", () => {
    // 23:30 UTC on Sunday 18 October is 00:30 on Monday 19 October in London.
    const plan = routineOf([MONDAY, TUESDAY, WEDNESDAY]);

    expect(
      summary("2026-10-22T06:00:00Z", { plan, lastCheckInAt: "2026-10-18T23:30:00Z" }),
    ).toEqual([]);
  });

  it("should send a missed reminder when the check-in switch is off", () => {
    const settings = { ...onlyMissedAndCheckin, checkinEnabled: false };

    expect(
      summary("2026-10-22T06:00:00Z", { settings, plan: routineOf([MONDAY, TUESDAY, WEDNESDAY]) }),
    ).toEqual(["missed 2026-10-22T08:00:00.000Z"]);
  });

  it("should send the check-in when only its own switch is on", () => {
    const settings = { ...onlyMissedAndCheckin, missedEnabled: false };
    const plan = routineOf([MONDAY, TUESDAY, WEDNESDAY]);

    expect(summary("2026-10-22T06:00:00Z", { settings, plan })).toEqual([
      "checkin 2026-10-22T08:00:00.000Z",
    ]);
    expect(
      summary("2026-10-21T06:00:00Z", { settings, plan: routineOf([MONDAY, TUESDAY]) }),
    ).toEqual([]);
  });

  it("should merge into the train time when the next day is a train day", () => {
    const settings = { ...onlyMissedAndCheckin, trainEnabled: true };

    expect(
      summary("2026-10-22T06:00:00Z", {
        settings,
        plan: routineOf([MONDAY, TUESDAY, WEDNESDAY, THURSDAY]),
      }),
    ).toEqual(["checkin 2026-10-22T16:30:00.000Z"]);
  });

  it("should keep sending Time to train after a check-in", () => {
    const settings = { ...onlyMissedAndCheckin, trainEnabled: true };
    const planned = summary("2026-10-22T20:00:00Z", {
      settings,
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY]),
      lastCheckInAt: "2026-10-22T08:00:00Z",
    });

    expect(planned).toEqual(["train 2026-10-23T16:30:00.000Z"]);
  });
});

describe("the missed and check-in words", () => {
  it("should carry the words of the variant they name, under the title of their type", () => {
    const plan = routineOf([MONDAY, TUESDAY, WEDNESDAY]);
    const [checkin] = planFor("2026-10-22T06:00:00Z", { plan });
    const [missed] = planFor("2026-10-21T06:00:00Z", { plan: routineOf([TUESDAY]) });

    expect(checkin?.title).toBe("Checking in");
    expect(TRAINING_REMINDER_VARIANTS.checkin.map(({ id }) => id)).toContain(checkin?.variantId);
    expect(checkin?.body).toBe(
      TRAINING_REMINDER_VARIANTS.checkin.find(({ id }) => id === checkin?.variantId)?.body,
    );
    expect(missed?.title).toBe("A fresh start");
    expect(TRAINING_REMINDER_VARIANTS.missed.map(({ id }) => id)).toContain(missed?.variantId);
  });

  it("should pick by the fire date, and move on from the one delivered last", () => {
    const now = "2026-10-21T06:00:00Z";
    const [first] = planFor(now);
    const [next] = planFor(now, {
      lastVariantIds: {
        train: null,
        progress: null,
        ease: null,
        missed: first?.variantId ?? null,
        checkin: null,
      },
    });

    expect(planFor(now)[0]?.variantId).toBe(first?.variantId);
    expect(next?.variantId).not.toBe(first?.variantId);
  });

  it("should pick a merged body from the merged set, and move on from the one delivered last", () => {
    const settings = { ...onlyMissedAndCheckin, trainEnabled: true };
    const options = { settings, plan: routineOf([TUESDAY, WEDNESDAY]) };
    const [first] = planFor("2026-10-20T18:00:00Z", options);
    const [next] = planFor("2026-10-20T18:00:00Z", {
      ...options,
      lastVariantIds: {
        train: null,
        progress: null,
        ease: null,
        missed: first?.variantId ?? null,
        checkin: null,
      },
    });

    expect(MISSED_MERGED_REMINDER_VARIANTS.map(({ id }) => id)).toContain(first?.variantId);
    expect(MISSED_MERGED_REMINDER_VARIANTS.map(({ id }) => id)).toContain(next?.variantId);
    expect(next?.variantId).not.toBe(first?.variantId);
  });
});

describe("the inputs", () => {
  it("should plan exactly as before while both switches are off", () => {
    const base = {
      settings: {
        ...onlyMissedAndCheckin,
        trainEnabled: true,
        missedEnabled: false,
        checkinEnabled: false,
      },
      plan: routineOf([MONDAY, TUESDAY, WEDNESDAY]),
    };
    const legacy = {
      ...base,
      settings: {
        trainEnabled: true,
        progressEnabled: false,
        easeEnabled: false,
        trainTime: "17:30",
      },
    };

    expect(planFor("2026-10-22T06:00:00Z", base)).toEqual(planFor("2026-10-22T06:00:00Z", legacy));
  });

  it("should refuse a routine whose active day is not a calendar day", () => {
    expect(() =>
      planFor("2026-10-22T06:00:00Z", { plan: routineOf([TUESDAY], "yesterday") }),
    ).toThrow(RangeError);
  });
});
