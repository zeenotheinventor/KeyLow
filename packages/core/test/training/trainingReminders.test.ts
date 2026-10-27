import { describe, expect, it } from "vitest";

import { benchPress, heatSet, repeat } from "./heatSets";
import { goldenRoutine, goldenTimeZone, pushMondayDayId, sessionOn } from "./weekPlanRows";
import {
  describeTrainingReminder,
  TRAINING_REMINDER_TITLES,
  TRAINING_REMINDER_VARIANTS,
} from "../../src/copy";
import {
  DEFAULT_TRAINING_REMINDER_SETTINGS,
  hasExerciseGainThisWeek,
  LOADED_HEAT_PERCENT,
  muscleState,
  planTrainingReminders,
  TRAINING_PARAMS_V2,
  weekPlanDays,
} from "../../src/training";
import { heatPercentOf } from "../../src/training/heatReadout";

import type { ExerciseMuscleEntry } from "../../src/schemas";
import type {
  ExerciseTrend,
  HeatSet,
  TrainingReminderInput,
  TrainingReminderSession,
} from "../../src/training";

// 2026-10-22 is a Thursday. London is on BST (UTC+1) until the clocks go back on Sunday 25 October, so the
// seven days from now take in a change of clocks. 09:00 UTC is 10:00 in London.
const NOW = "2026-10-22T09:00:00Z";
const LONDON = "Europe/London";

const everythingOn = {
  trainEnabled: true,
  progressEnabled: true,
  easeEnabled: true,
  trainTime: "17:30",
};
const noneUsed = { train: null, progress: null, ease: null };

const chest = [{ muscle_id: "chest_lower", role: "primary" }] as const;
const legs = [{ muscle_id: "quads", role: "primary" }] as const;
const plannedDay = (
  weekday: number | null,
  muscles: readonly Pick<ExerciseMuscleEntry, "muscle_id" | "role">[],
) => ({
  weekday,
  exercises: [{ muscles }],
});

// Thursday chest, Friday legs and Monday chest.
const plan = {
  days: [plannedDay(3, chest), plannedDay(4, legs), plannedDay(0, chest)],
};

const input = (overrides: Partial<TrainingReminderInput> = {}): TrainingReminderInput => ({
  now: NOW,
  timeZone: LONDON,
  settings: everythingOn,
  plan,
  sessions: [],
  heatSets: [],
  weeklyGain: false,
  lastVariantIds: noneUsed,
  ...overrides,
});

const plannedFor = (overrides: Partial<TrainingReminderInput> = {}) =>
  planTrainingReminders(input(overrides));
const firesOf = (type: string, overrides: Partial<TrainingReminderInput> = {}) =>
  plannedFor(overrides)
    .filter((reminder) => reminder.type === type)
    .map((reminder) => reminder.fireAt);

const session = (overrides: Partial<TrainingReminderSession> = {}): TrainingReminderSession => ({
  local_date: "2026-10-22",
  ended_at: "2026-10-22T08:00:00Z",
  deleted_at: null,
  ...overrides,
});

const chestSets = (count: number, performedAt: string): HeatSet[] =>
  repeat(count, heatSet(benchPress, { performed_at: performedAt }));
// The fewest sets, all performed at one moment, that make the chest loaded at a later moment.
const fewestLoadingSets = (performedAt: string, at: string): number => {
  for (let count = 1; count < 200; count += 1) {
    const { heat } = muscleState(chestSets(count, performedAt), at, TRAINING_PARAMS_V2).chest_lower;
    if (heatPercentOf(heat) >= LOADED_HEAT_PERCENT) {
      return count;
    }
  }
  throw new Error("The chest never loads");
};

describe("the settings", () => {
  it("should default to all three off at half past five in the evening", () => {
    expect(DEFAULT_TRAINING_REMINDER_SETTINGS).toEqual({
      trainEnabled: false,
      progressEnabled: false,
      easeEnabled: false,
      trainTime: "17:30",
    });
  });

  it("should plan nothing with every setting off", () => {
    expect(
      plannedFor({
        settings: DEFAULT_TRAINING_REMINDER_SETTINGS,
        weeklyGain: true,
        heatSets: chestSets(40, "2026-10-22T06:00:00Z"),
      }),
    ).toEqual([]);
  });

  it("should plan only the reminders that are on", () => {
    const settings = { ...everythingOn, progressEnabled: false, easeEnabled: false };

    expect(new Set(plannedFor({ settings, weeklyGain: true }).map(({ type }) => type))).toEqual(
      new Set(["train"]),
    );
  });
});

describe("Time to train", () => {
  it("should fire on each planned day in the next seven days at the train time in the zone", () => {
    expect(firesOf("train")).toEqual([
      "2026-10-22T16:30:00.000Z",
      "2026-10-23T16:30:00.000Z",
      "2026-10-26T17:30:00.000Z",
    ]);
  });

  it("should follow the clocks going back, not a fixed offset from UTC", () => {
    const sundayPlan = { days: [plannedDay(5, chest), plannedDay(6, chest)] };

    expect(firesOf("train", { plan: sundayPlan })).toEqual([
      "2026-10-24T16:30:00.000Z",
      "2026-10-25T17:30:00.000Z",
    ]);
  });

  it("should use the zone of the person, so a day can differ from the UTC date", () => {
    // 02:00 UTC on Friday 23 October is 22:00 on Thursday 22 October in New York.
    const reminders = firesOf("train", {
      now: "2026-10-23T02:00:00Z",
      timeZone: "America/New_York",
    });

    // Thursday's 17:30 has passed in New York, so the first is Friday's, and Monday's follows.
    expect(reminders).toEqual(["2026-10-23T21:30:00.000Z", "2026-10-26T21:30:00.000Z"]);
  });

  it("should use the train time that was set", () => {
    expect(firesOf("train", { settings: { ...everythingOn, trainTime: "07:05" } })[0]).toBe(
      "2026-10-23T06:05:00.000Z",
    );
  });

  it("should skip today when the train time has passed", () => {
    expect(firesOf("train", { now: "2026-10-22T16:30:00Z" })).toEqual([
      "2026-10-23T16:30:00.000Z",
      "2026-10-26T17:30:00.000Z",
    ]);
  });

  it("should skip today when a session was finished today", () => {
    expect(firesOf("train", { sessions: [session()] })).toEqual([
      "2026-10-23T16:30:00.000Z",
      "2026-10-26T17:30:00.000Z",
    ]);
  });

  it("should not skip today for a session that is open, deleted or on another day", () => {
    const others = [
      session({ ended_at: null }),
      session({ deleted_at: "2026-10-22T08:30:00Z" }),
      session({ local_date: "2026-10-21", ended_at: "2026-10-21T18:00:00Z" }),
    ];

    expect(firesOf("train", { sessions: others })).toHaveLength(3);
  });

  it("should skip today for a session that makes up an earlier day, though the week then reads today as planned (KEY-531)", () => {
    // Monday's Push is missed and made up on Thursday, so the strip leaves Thursday's own slot open.
    const pushOnThursday = sessionOn(1, "2026-10-22", {
      routine_day_id: pushMondayDayId,
      ended_at: "2026-10-22T08:00:00Z",
    });
    const week = weekPlanDays({
      routine: goldenRoutine,
      sessions: [pushOnThursday],
      now: NOW,
      tz: goldenTimeZone,
      weekStart: "2026-10-19",
    });

    expect(week.days.map((day) => day.status).slice(0, 4)).toEqual([
      "logged",
      "missed",
      "rest",
      "today",
    ]);
    expect(firesOf("train", { sessions: [pushOnThursday] })).toEqual([
      "2026-10-23T16:30:00.000Z",
      "2026-10-26T17:30:00.000Z",
    ]);
  });

  it("should skip a later day that is already logged", () => {
    const friday = session({ local_date: "2026-10-23", ended_at: "2026-10-23T09:00:00Z" });

    expect(firesOf("train", { sessions: [friday] })).toEqual([
      "2026-10-22T16:30:00.000Z",
      "2026-10-26T17:30:00.000Z",
    ]);
  });

  it("should plan none with no routine, or a routine with no placed day", () => {
    expect(firesOf("train", { plan: null })).toEqual([]);
    expect(firesOf("train", { plan: { days: [plannedDay(null, chest)] } })).toEqual([]);
  });
});

describe("See your progress", () => {
  it("should fire this week's Sunday at 19:00 in the zone when an exercise went up", () => {
    expect(firesOf("progress", { weeklyGain: true })).toEqual(["2026-10-25T19:00:00.000Z"]);
  });

  it("should not fire when nothing went up", () => {
    expect(firesOf("progress", { weeklyGain: false })).toEqual([]);
  });

  it("should fire on a Sunday that is today while 19:00 is still ahead, and not after it", () => {
    const sunday = "2026-10-25T10:00:00Z";

    expect(firesOf("progress", { now: sunday, weeklyGain: true })).toEqual([
      "2026-10-25T19:00:00.000Z",
    ]);
    expect(firesOf("progress", { now: "2026-10-25T19:00:00Z", weeklyGain: true })).toEqual([]);
  });

  it("should fire without a routine", () => {
    expect(firesOf("progress", { plan: null, weeklyGain: true })).toHaveLength(1);
  });
});

describe("Take it easy", () => {
  // Thursday, Friday and Saturday are all chest days. Ease is judged at 08:00 London: 07:00 UTC.
  const chestDays = { days: [plannedDay(3, chest), plannedDay(4, chest), plannedDay(5, chest)] };
  const THURSDAY_MORNING = "2026-10-22T07:00:00Z";
  const FRIDAY_MORNING = "2026-10-23T07:00:00Z";
  const THURSDAY_EARLY = "2026-10-22T06:00:00Z";
  const WEDNESDAY_EVENING = "2026-10-21T17:00:00Z";
  const easeFires = (overrides: Partial<TrainingReminderInput>) =>
    firesOf("ease", { plan: chestDays, ...overrides });
  const trainFires = (overrides: Partial<TrainingReminderInput>) =>
    firesOf("train", { plan: chestDays, ...overrides });

  it("should fire at 08:00 in the zone on a planned day that is loaded, and replace Time to train that day", () => {
    const heatSets = chestSets(
      fewestLoadingSets(WEDNESDAY_EVENING, THURSDAY_MORNING),
      WEDNESDAY_EVENING,
    );
    const options = { now: THURSDAY_EARLY, heatSets };

    expect(easeFires(options)).toEqual(["2026-10-22T07:00:00.000Z"]);
    expect(trainFires(options)).not.toContain("2026-10-22T16:30:00.000Z");
    expect(trainFires(options)).toContain("2026-10-23T16:30:00.000Z");
  });

  it("should give the same answer for a day however late in the day it is planned", () => {
    // Eleven sets on Wednesday at noon leave the chest at 61 % at Thursday 08:00 London and at 57 % two
    // hours later. Judging at the moment of planning would flip the answer between the two plans.
    const heatSets = chestSets(11, "2026-10-21T12:00:00Z");
    const thursdayTrain = "2026-10-22T16:30:00.000Z";

    for (const now of ["2026-10-22T06:00:00Z", "2026-10-22T09:00:00Z"]) {
      expect(trainFires({ heatSets, now })).not.toContain(thursdayTrain);
    }
    expect(easeFires({ heatSets, now: "2026-10-22T06:00:00Z" })).toContain(
      "2026-10-22T07:00:00.000Z",
    );
  });

  it("should judge tomorrow too, with the heat as it will be by tomorrow morning", () => {
    const performedAt = "2026-10-22T06:00:00Z";
    const heatSets = chestSets(fewestLoadingSets(performedAt, FRIDAY_MORNING), performedAt);

    expect(easeFires({ heatSets })).toContain("2026-10-23T07:00:00.000Z");
    expect(trainFires({ heatSets })).not.toContain("2026-10-23T16:30:00.000Z");
  });

  it("should leave out a set performed after now, which has not happened yet", () => {
    // Sixty sets logged for the afternoon, after the 09:00 UTC of now, load nothing by tomorrow morning.
    const heatSets = chestSets(60, "2026-10-22T12:00:00Z");

    expect(easeFires({ heatSets })).toEqual([]);
    expect(trainFires({ heatSets })).toContain("2026-10-23T16:30:00.000Z");
  });

  it("should not judge the days after tomorrow, however loaded", () => {
    const heatSets = chestSets(60, "2026-10-22T06:00:00Z");

    expect(easeFires({ heatSets })).not.toContain("2026-10-24T07:00:00.000Z");
    expect(trainFires({ heatSets })).toContain("2026-10-24T16:30:00.000Z");
  });

  it("should fire only from the loaded edge of the body map, not a set below it", () => {
    const performedAt = "2026-10-22T06:00:00Z";
    const loading = fewestLoadingSets(performedAt, FRIDAY_MORNING);

    expect(easeFires({ heatSets: chestSets(loading, performedAt) })).toContain(
      "2026-10-23T07:00:00.000Z",
    );
    expect(easeFires({ heatSets: chestSets(loading - 1, performedAt) })).not.toContain(
      "2026-10-23T07:00:00.000Z",
    );
    expect(trainFires({ heatSets: chestSets(loading - 1, performedAt) })).toContain(
      "2026-10-23T16:30:00.000Z",
    );
  });

  it("should suppress Time to train for a loaded day today even when 08:00 has passed", () => {
    const heatSets = chestSets(fewestLoadingSets(WEDNESDAY_EVENING, NOW), WEDNESDAY_EVENING);

    expect(easeFires({ heatSets })).not.toContain("2026-10-22T07:00:00.000Z");
    expect(trainFires({ heatSets })).not.toContain("2026-10-22T16:30:00.000Z");
  });

  it("should read a primary muscle of the day only", () => {
    // The chest is loaded, but Friday's day trains the quads, with the chest as a secondary muscle.
    const heatSets = chestSets(60, "2026-10-22T06:00:00Z");
    const legsDay = {
      days: [
        plannedDay(4, [
          { muscle_id: "quads", role: "primary" },
          { muscle_id: "chest_lower", role: "secondary" },
        ]),
      ],
    };

    expect(easeFires({ plan: legsDay, heatSets })).toEqual([]);
    expect(firesOf("train", { plan: legsDay, heatSets })).toContain("2026-10-23T16:30:00.000Z");
  });

  it("should leave Time to train alone when Take it easy is off", () => {
    const heatSets = chestSets(60, "2026-10-22T06:00:00Z");
    const settings = { ...everythingOn, easeEnabled: false };

    expect(easeFires({ heatSets, settings })).toEqual([]);
    expect(trainFires({ heatSets, settings })).toContain("2026-10-23T16:30:00.000Z");
  });

  it("should not fire for a day that is already logged, or with no routine", () => {
    const heatSets = chestSets(60, "2026-10-22T06:00:00Z");
    const friday = session({ local_date: "2026-10-23", ended_at: "2026-10-23T09:00:00Z" });

    expect(easeFires({ heatSets, sessions: [friday] })).not.toContain("2026-10-23T07:00:00.000Z");
    expect(easeFires({ heatSets, plan: null })).toEqual([]);
  });

  it("should judge the day in the zone of the person", () => {
    // 04:00 UTC on Friday 23 October is Thursday 22 October in Los Angeles (21:00 PDT), where tomorrow
    // is Friday 23 October and 08:00 is 15:00 UTC.
    const heatSets = chestSets(60, "2026-10-22T20:00:00Z");

    expect(
      easeFires({ heatSets, now: "2026-10-23T04:00:00Z", timeZone: "America/Los_Angeles" }),
    ).toEqual(["2026-10-23T15:00:00.000Z"]);
  });
});

describe("the variants", () => {
  const reminderOf = (type: string, overrides: Partial<TrainingReminderInput> = {}) =>
    plannedFor(overrides).filter((reminder) => reminder.type === type);
  const idsOf = (type: string, overrides: Partial<TrainingReminderInput> = {}) =>
    reminderOf(type, overrides).map(({ variantId }) => variantId);

  it("should carry the words of the variant it names, under the one title of its type", () => {
    for (const reminder of plannedFor({ weeklyGain: true })) {
      const words = describeTrainingReminder(reminder.type, reminder.variantId);

      expect(reminder.title).toBe(TRAINING_REMINDER_TITLES[reminder.type]);
      expect(reminder.title).toBe(words.title);
      expect(reminder.body).toBe(words.body);
    }
  });

  it("should pick by the fire date, so the same date gets the same variant", () => {
    expect(idsOf("train", { now: "2026-10-22T08:00:00Z" })).toEqual(idsOf("train"));
  });

  it("should pick the variant from the fire date, pinned so a change is deliberate", () => {
    // Day numbers 20748, 20749 and 20752 (22, 23 and 26 October 2026) modulo the eight train variants.
    expect(idsOf("train")).toEqual(["train-5", "train-6", "train-1"]);
    expect(idsOf("progress", { weeklyGain: true })).toEqual(["progress-4"]);
  });

  it("should move on by one when the date's variant is the one delivered last", () => {
    expect(idsOf("train", { lastVariantIds: { ...noneUsed, train: "train-5" } })).toEqual([
      "train-6",
      "train-7",
      "train-1",
    ]);
  });

  it("should never repeat the variant delivered last, whichever it was", () => {
    for (const { id } of TRAINING_REMINDER_VARIANTS.train) {
      const [first] = idsOf("train", { lastVariantIds: { ...noneUsed, train: id } });

      expect(first).not.toBe(id);
    }
  });

  it("should give seven consecutive days seven different variants", () => {
    const everyDay = { days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => plannedDay(weekday, chest)) };
    for (const now of ["2026-10-22T09:00:00Z", "2026-11-03T09:00:00Z", "2027-01-01T09:00:00Z"]) {
      const ids = idsOf("train", { plan: everyDay, now });

      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("should keep the last delivered of each type apart", () => {
    const options = { weeklyGain: true, lastVariantIds: { ...noneUsed, train: "train-5" } };

    expect(idsOf("train", options)[0]).not.toBe("train-5");
    expect(idsOf("progress", options)).toEqual(idsOf("progress", { weeklyGain: true }));
  });

  it("should refuse an id that is no variant of the type", () => {
    expect(() => describeTrainingReminder("train", "progress-1")).toThrow(RangeError);
  });
});

describe("the order and the window", () => {
  it("should list the reminders by fire time", () => {
    const fires = plannedFor({ weeklyGain: true }).map(({ fireAt }) => fireAt);

    expect(fires).toEqual([...fires].sort());
  });

  it("should plan only from now and within seven days", () => {
    const fires = plannedFor({
      weeklyGain: true,
      plan: { days: [0, 1, 2, 3, 4, 5, 6].map((day) => plannedDay(day, chest)) },
    });

    for (const { fireAt } of fires) {
      expect(fireAt > "2026-10-22T09:00:00.000Z").toBe(true);
      expect(fireAt < "2026-10-29T09:00:00.000Z").toBe(true);
    }
  });
});

describe("the inputs", () => {
  it("should refuse a zone that is not an IANA name, a train time that is not HH:MM and a now with no zone", () => {
    expect(() => plannedFor({ timeZone: "Mars/Olympus" })).toThrow(RangeError);
    expect(() => plannedFor({ settings: { ...everythingOn, trainTime: "5:30pm" } })).toThrow(
      RangeError,
    );
    expect(() => plannedFor({ now: "2026-10-22T09:00:00" })).toThrow(RangeError);
  });
});

describe("hasExerciseGainThisWeek", () => {
  const week = (change: ExerciseTrend["weeks"][number]["change"]): ExerciseTrend => ({
    weeks: [
      { weekStart: "2026-10-12", value: { loadKg: 60, reps: 8 }, change: { kind: "first" } },
      change === null
        ? { weekStart: "2026-10-19", value: null, change: null }
        : { weekStart: "2026-10-19", value: { loadKg: 62.5, reps: 8 }, change },
    ],
    latest: null,
  });
  const loadChange = (previousLoadKg: number | null, latestLoadKg: number | null) =>
    ({ kind: "load", previousLoadKg, latestLoadKg, repsChange: 0 }) as const;

  it("should be true when an exercise has a heavier load or more reps this week", () => {
    expect(hasExerciseGainThisWeek([week(loadChange(60, 62.5))])).toBe(true);
    expect(hasExerciseGainThisWeek([week(loadChange(null, 10))])).toBe(true);
    expect(hasExerciseGainThisWeek([week({ kind: "reps", repsChange: 1 })])).toBe(true);
  });

  it("should be false for the same, a first week, fewer reps, a lighter load and an untrained week", () => {
    expect(hasExerciseGainThisWeek([week({ kind: "same" })])).toBe(false);
    expect(hasExerciseGainThisWeek([week({ kind: "first" })])).toBe(false);
    expect(hasExerciseGainThisWeek([week({ kind: "reps", repsChange: -2 })])).toBe(false);
    expect(hasExerciseGainThisWeek([week(loadChange(62.5, 60))])).toBe(false);
    expect(hasExerciseGainThisWeek([week(loadChange(10, null))])).toBe(false);
    expect(hasExerciseGainThisWeek([week(null)])).toBe(false);
    expect(hasExerciseGainThisWeek([])).toBe(false);
  });

  it("should be true when any one exercise gained", () => {
    expect(hasExerciseGainThisWeek([week({ kind: "same" }), week(loadChange(60, 62.5))])).toBe(
      true,
    );
  });
});
