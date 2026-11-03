import { TRAIN_REMINDER_NAMES_ROUTINE_DAY, TRAINING_REMINDER_TITLES } from "@keylow/core/copy";

import {
  readScheduledReminders,
  scheduleReminderPlan,
  scheduledRemindersStorageKey,
} from "../lib/reminderScheduler";
import { defaultReminderSettings } from "../lib/reminderSettings";
import {
  mockExpoNotifications,
  notificationsState,
  resetNotificationsMock,
} from "./support/expoNotificationsMock";

import type {
  FoodReminderPlanInputs,
  ReminderPlanInputs,
  ScheduleReminderPlanInput,
} from "../lib/reminderScheduler";

const mockStorageItems = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));
jest.mock(
  "expo-notifications",
  () =>
    jest.requireActual<typeof import("./support/expoNotificationsMock")>(
      "./support/expoNotificationsMock",
    ).mockExpoNotifications,
);

// 2026-10-22 is a Thursday. London is on BST (UTC+1), so 09:00 UTC is 10:00 there and 17:30 is 16:30 UTC.
const NOW = new Date("2026-10-22T09:00:00.000Z");
const LONDON = "Europe/London";

const RECOGNISABLE_EXERCISE = "key511-recognisable-exercise";
const RECOGNISABLE_DAY = "key511-recognisable-day";
const RECOGNISABLE_LOAD = 187.25;

const everythingOn = {
  ...defaultReminderSettings,
  trainEnabled: true,
  progressEnabled: true,
  easeEnabled: true,
};

// Thursday, Saturday and Sunday are routine days. The extra fields stand for what a real routine carries,
// which must not get into a reminder.
const plannedDay = (weekday: number) => ({
  weekday,
  name: RECOGNISABLE_DAY,
  exercises: [
    {
      name: RECOGNISABLE_EXERCISE,
      load: RECOGNISABLE_LOAD,
      muscles: [{ muscle_id: "chest_lower" as const, role: "primary" as const }],
    },
  ],
});
const plan = { days: [plannedDay(3), plannedDay(5), plannedDay(6)] };

// Today, Thursday, is not planned, and Friday is, so Friday morning is judged.
const fridayPlan = { days: [plannedDay(4)] };

type PlanInputOverrides = Partial<ReminderPlanInputs> &
  Pick<Partial<ScheduleReminderPlanInput>, "settings" | "foodInputs">;

const input = ({
  settings = everythingOn,
  foodInputs = { timeZone: LONDON, loggedToday: false },
  ...overrides
}: PlanInputOverrides = {}): ScheduleReminderPlanInput => ({
  now: NOW,
  settings,
  foodInputs,
  inputs: {
    timeZone: LONDON,
    plan,
    sessions: [],
    heatSets: [],
    weeklyGain: true,
    ...overrides,
  },
});

const scheduledFires = () =>
  [...notificationsState.scheduled.values()].map(({ identifier, trigger }) => ({
    type: identifier.split(":")[1],
    fireAt: new Date(trigger.date).toISOString(),
  }));

describe("scheduling the reminders", () => {
  beforeEach(() => {
    resetNotificationsMock();
    mockStorageItems.clear();
    notificationsState.permission = "granted";
    jest.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("when the reminders are allowed", () => {
    it("should schedule the planned reminders, each carrying only its type", async () => {
      await scheduleReminderPlan(input());

      const fires = scheduledFires();
      expect(fires).toContainEqual({ type: "train", fireAt: "2026-10-22T16:30:00.000Z" });
      expect(fires).toContainEqual({ type: "train", fireAt: "2026-10-24T16:30:00.000Z" });
      expect(fires).toContainEqual({ type: "progress", fireAt: "2026-10-25T19:00:00.000Z" });
      for (const { content } of notificationsState.scheduled.values()) {
        expect(Object.keys(content.data ?? {})).toEqual(["type"]);
      }
    });

    it("should replace what was scheduled before and leave other notifications alone", async () => {
      notificationsState.scheduled.set("keylow-reminder:train:1", {
        identifier: "keylow-reminder:train:1",
        content: {},
        trigger: { type: "date", date: 1 },
      });
      notificationsState.scheduled.set("somebody-else", {
        identifier: "somebody-else",
        content: {},
        trigger: { type: "date", date: 1 },
      });

      await scheduleReminderPlan(input());

      expect(notificationsState.scheduled.has("keylow-reminder:train:1")).toBe(false);
      expect(notificationsState.scheduled.has("somebody-else")).toBe(true);
    });

    it("should plan at the train time of the settings", async () => {
      await scheduleReminderPlan(
        input({ settings: { ...everythingOn, trainTime: "07:05", progressEnabled: false } }),
      );

      // Today's 07:05 has passed, so the first is Saturday's, in London time.
      expect(scheduledFires()).toContainEqual({
        type: "train",
        fireAt: "2026-10-24T06:05:00.000Z",
      });
    });

    it("should drop today's train reminder once a session was finished today", async () => {
      await scheduleReminderPlan(
        input({
          sessions: [
            { local_date: "2026-10-22", ended_at: "2026-10-22T08:30:00Z", deleted_at: null },
          ],
        }),
      );

      const trains = scheduledFires().filter(({ type }) => type === "train");
      // The clocks go back on Sunday 25 October, so Sunday's 17:30 is 17:30 UTC.
      expect(trains.map(({ fireAt }) => fireAt)).toEqual([
        "2026-10-24T16:30:00.000Z",
        "2026-10-25T17:30:00.000Z",
      ]);
    });

    it("should plan the take it easy reminder from the logged sets", async () => {
      const performedAt = "2026-10-21T17:00:00.000Z";
      const heatSets = Array.from({ length: 30 }, () => ({
        set_type: "working" as const,
        rir: null,
        rpe: null,
        performed_at: performedAt,
        deleted_at: null,
        snapshot: {
          muscles: [{ muscle_id: "chest_lower" as const, role: "primary" as const, weight: 1 }],
        },
      }));

      await scheduleReminderPlan(
        input({
          heatSets,
          plan: fridayPlan,
          settings: { ...everythingOn, trainEnabled: false, progressEnabled: false },
        }),
      );

      expect(scheduledFires()).toEqual([{ type: "ease", fireAt: "2026-10-23T07:00:00.000Z" }]);
    });
  });

  describe("the food reminder", () => {
    const foodOn = { ...defaultReminderSettings, foodEnabled: true };
    const foodFires = () => scheduledFires().filter(({ type }) => type === "food");
    const loggedInputs: FoodReminderPlanInputs = { timeZone: LONDON, loggedToday: true };

    it("should schedule one a day at the food time, each carrying only its type", async () => {
      await scheduleReminderPlan(input({ settings: foodOn }));

      // 20:00 in London is 19:00 UTC until the clocks go back on Sunday 25 October, then 20:00 UTC.
      expect(foodFires().map(({ fireAt }) => fireAt)).toEqual([
        "2026-10-22T19:00:00.000Z",
        "2026-10-23T19:00:00.000Z",
        "2026-10-24T19:00:00.000Z",
        "2026-10-25T20:00:00.000Z",
        "2026-10-26T20:00:00.000Z",
        "2026-10-27T20:00:00.000Z",
        "2026-10-28T20:00:00.000Z",
      ]);
      for (const { content } of notificationsState.scheduled.values()) {
        expect(content.data).toEqual({ type: "food" });
      }
    });

    it("should plan at the food time of the settings", async () => {
      await scheduleReminderPlan(input({ settings: { ...foodOn, foodTime: "21:30" } }));

      expect(foodFires()[0]).toEqual({ type: "food", fireAt: "2026-10-22T20:30:00.000Z" });
    });

    it("should drop today's once something was logged today, and keep the other days", async () => {
      await scheduleReminderPlan(input({ settings: foodOn, foodInputs: loggedInputs }));

      expect(foodFires()).toHaveLength(6);
      expect(foodFires()[0]?.fireAt).toBe("2026-10-23T19:00:00.000Z");
    });

    it("should schedule nothing for food while its switch is off", async () => {
      await scheduleReminderPlan(input());

      expect(foodFires()).toEqual([]);
    });

    it("should schedule it beside the training ones through the one replace", async () => {
      await scheduleReminderPlan(input({ settings: { ...everythingOn, foodEnabled: true } }));

      const types = new Set(scheduledFires().map(({ type }) => type));
      expect(types).toEqual(new Set(["train", "progress", "food"]));
    });

    it("should schedule it with the training switches off and their inputs not loaded", async () => {
      await scheduleReminderPlan({ ...input({ settings: foodOn }), inputs: null });

      expect(foodFires()).toHaveLength(7);
    });

    it("should keep the schedule it has while the food inputs are not loaded", async () => {
      await scheduleReminderPlan(input({ settings: foodOn }));
      const before = [...notificationsState.scheduled.keys()];

      await scheduleReminderPlan({ ...input({ settings: foodOn }), foodInputs: null });

      expect([...notificationsState.scheduled.keys()]).toEqual(before);
    });

    it("should plan the training ones without the food inputs while the food switch is off", async () => {
      await scheduleReminderPlan({ ...input(), foodInputs: null });

      expect(scheduledFires().length).toBeGreaterThan(0);
    });

    it("should keep the training ones while the training inputs are not loaded and a switch is on", async () => {
      await scheduleReminderPlan(input({ settings: { ...everythingOn, foodEnabled: true } }));
      const before = [...notificationsState.scheduled.keys()];

      await scheduleReminderPlan({
        ...input({ settings: { ...everythingOn, foodEnabled: true } }),
        inputs: null,
      });

      expect([...notificationsState.scheduled.keys()]).toEqual(before);
    });

    it("should not repeat the food wording already delivered", async () => {
      await scheduleReminderPlan(input({ settings: foodOn }));
      const unconstrained = (await readScheduledReminders()).find(
        ({ type, fireAt }) => type === "food" && Date.parse(fireAt) > NOW.getTime(),
      )?.variantId;
      resetNotificationsMock();
      notificationsState.permission = "granted";
      mockStorageItems.set(
        scheduledRemindersStorageKey,
        JSON.stringify([
          { type: "food", fireAt: "2026-10-21T19:00:00.000Z", variantId: unconstrained },
        ]),
      );

      await scheduleReminderPlan(input({ settings: foodOn }));

      const first = (await readScheduledReminders()).find(
        ({ type, fireAt }) => type === "food" && Date.parse(fireAt) > NOW.getTime(),
      );
      expect(first?.variantId).not.toBe(unconstrained);
    });

    it("should cancel the lot when the food switch is the only one on and the permission is denied", async () => {
      notificationsState.permission = "denied";
      notificationsState.scheduled.set("keylow-reminder:food:1", {
        identifier: "keylow-reminder:food:1",
        content: {},
        trigger: { type: "date", date: 1 },
      });

      await scheduleReminderPlan(input({ settings: foodOn }));

      expect(notificationsState.scheduled.size).toBe(0);
    });
  });

  describe("the missed day and check in reminders", () => {
    // Thursday 07:00 in London, so this morning's 09:00 is still ahead.
    const MORNING = new Date("2026-10-22T06:00:00.000Z");
    const MISSED_FIRE_TODAY = "2026-10-22T08:00:00.000Z";
    const MISSED_FIRE_TOMORROW = "2026-10-23T08:00:00.000Z";
    // Monday 26 October is planned and missed too, the clocks have gone back, so Tuesday's 09:00 is 09:00 UTC.
    const NEXT_MISS_MORNING = "2026-10-27T09:00:00.000Z";
    const missedOn = { ...defaultReminderSettings, missedEnabled: true };
    const checkinOn = { ...defaultReminderSettings, checkinEnabled: true };

    // A routine day as the plan inputs carry it: the id and position are what a make-up is found by.
    const routineDay = (weekday: number) => ({
      ...plannedDay(weekday),
      id: `day-${weekday}`,
      position: weekday,
    });
    const finishedOn = (weekday: number, date: string) => ({
      id: `session-${date}`,
      local_date: date,
      started_at: `${date}T08:00:00Z`,
      ended_at: `${date}T09:00:00Z`,
      deleted_at: null,
      routine_day_id: `day-${weekday}`,
    });
    // The notifications module drops a fire time that is behind the clock, so the clock moves with the plan.
    const at = (now: Date, overrides: Parameters<typeof input>[0]) => {
      jest.setSystemTime(now);
      return { ...input(overrides), now };
    };
    const missedOrCheckin = () =>
      scheduledFires().filter(({ type }) => type === "missed" || type === "checkin");

    // Wednesday was planned and nothing was done. The routine began the Monday before.
    const wednesdayMissed = { plan: { days: [routineDay(2)], activeFrom: "2026-10-19" } };
    // Monday to Wednesday were planned and nothing was done.
    const threeDaysMissed = {
      plan: { days: [routineDay(0), routineDay(1), routineDay(2)], activeFrom: "2026-10-19" },
    };

    it("should plan neither while both are off, with a planned day missed yesterday", async () => {
      await scheduleReminderPlan(
        at(MORNING, {
          ...wednesdayMissed,
          settings: { ...defaultReminderSettings, trainEnabled: true },
        }),
      );

      expect(missedOrCheckin()).toEqual([]);
    });

    it("should schedule a missed reminder for this morning when a planned day went by yesterday, with only its switch on", async () => {
      await scheduleReminderPlan(at(MORNING, { ...wednesdayMissed, settings: missedOn }));

      expect(scheduledFires()).toEqual([{ type: "missed", fireAt: MISSED_FIRE_TODAY }]);
    });

    it("should drop the missed reminder projected for tomorrow once a session is finished today", async () => {
      const thursdayOnly = { plan: { days: [routineDay(3)], activeFrom: "2026-10-19" } };
      await scheduleReminderPlan(at(MORNING, { ...thursdayOnly, settings: missedOn }));
      expect(scheduledFires()).toEqual([{ type: "missed", fireAt: MISSED_FIRE_TOMORROW }]);

      await scheduleReminderPlan(
        at(new Date("2026-10-22T10:00:00.000Z"), {
          ...thursdayOnly,
          sessions: [finishedOn(3, "2026-10-22")],
          settings: missedOn,
        }),
      );

      expect(missedOrCheckin()).toEqual([]);
    });

    it("should not call a day missed that a session made up late", async () => {
      await scheduleReminderPlan(
        at(MORNING, {
          ...wednesdayMissed,
          sessions: [{ ...finishedOn(2, "2026-10-21"), local_date: "2026-10-22" }],
          settings: missedOn,
        }),
      );

      expect(missedOrCheckin()).toEqual([]);
    });

    describe("the check in after several missed days", () => {
      const storedCheckIns = () =>
        readScheduledReminders().then((stored) => stored.filter(({ type }) => type === "checkin"));

      it("should schedule it in place of the missed one, with only its switch on", async () => {
        await scheduleReminderPlan(at(MORNING, { ...threeDaysMissed, settings: checkinOn }));

        expect(scheduledFires()).toEqual([{ type: "checkin", fireAt: MISSED_FIRE_TODAY }]);
      });

      it("should plan it again while the one scheduled has not fired yet", async () => {
        await scheduleReminderPlan(at(MORNING, { ...threeDaysMissed, settings: checkinOn }));

        await scheduleReminderPlan(
          at(new Date("2026-10-22T07:00:00.000Z"), { ...threeDaysMissed, settings: checkinOn }),
        );

        expect(scheduledFires()).toEqual([{ type: "checkin", fireAt: MISSED_FIRE_TODAY }]);
      });

      it("should send it once for the streak, from the fire time in the stored plan, across restarts", async () => {
        await scheduleReminderPlan(at(MORNING, { ...threeDaysMissed, settings: checkinOn }));
        expect(await storedCheckIns()).toHaveLength(1);
        // The app is closed and opened again after the check in fired.
        resetNotificationsMock();
        notificationsState.permission = "granted";

        await scheduleReminderPlan(
          at(new Date("2026-10-22T10:00:00.000Z"), { ...threeDaysMissed, settings: checkinOn }),
        );

        expect(missedOrCheckin()).toEqual([]);
        expect(await storedCheckIns()).toHaveLength(1);
      });

      it("should not count a check in cancelled while every switch was off as delivered", async () => {
        await scheduleReminderPlan(at(MORNING, { ...threeDaysMissed, settings: checkinOn }));
        expect(await storedCheckIns()).toHaveLength(1);
        // Every switch off cancels the check in that was still ahead.
        await scheduleReminderPlan(
          at(new Date("2026-10-22T07:00:00.000Z"), { settings: defaultReminderSettings }),
        );
        expect(await storedCheckIns()).toEqual([]);

        await scheduleReminderPlan(
          at(new Date("2026-10-22T10:00:00.000Z"), { ...threeDaysMissed, settings: checkinOn }),
        );

        expect(scheduledFires()).toEqual([{ type: "checkin", fireAt: NEXT_MISS_MORNING }]);
      });

      it("should send it on the next miss morning when no plan says one was delivered", async () => {
        await scheduleReminderPlan(
          at(new Date("2026-10-22T10:00:00.000Z"), { ...threeDaysMissed, settings: checkinOn }),
        );

        expect(scheduledFires()).toEqual([{ type: "checkin", fireAt: NEXT_MISS_MORNING }]);
      });
    });
  });

  describe("when nothing is to be scheduled", () => {
    it("should cancel ours and schedule nothing when every switch is off", async () => {
      notificationsState.scheduled.set("keylow-reminder:train:1", {
        identifier: "keylow-reminder:train:1",
        content: {},
        trigger: { type: "date", date: 1 },
      });

      await scheduleReminderPlan(input({ settings: defaultReminderSettings }));

      expect(notificationsState.scheduled.size).toBe(0);
      expect(mockExpoNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it.each(["denied", "undetermined"] as const)(
      "should cancel ours and schedule nothing when the permission is %s",
      async (permission) => {
        notificationsState.permission = permission;
        notificationsState.scheduled.set("keylow-reminder:train:1", {
          identifier: "keylow-reminder:train:1",
          content: {},
          trigger: { type: "date", date: 1 },
        });

        await scheduleReminderPlan(input());

        expect(notificationsState.scheduled.size).toBe(0);
        expect(mockExpoNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      },
    );
  });

  describe("when the inputs are not loaded", () => {
    it("should keep the schedule it has", async () => {
      await scheduleReminderPlan(input());
      const before = [...notificationsState.scheduled.keys()];

      await scheduleReminderPlan({ ...input(), inputs: null });

      expect([...notificationsState.scheduled.keys()]).toEqual(before);
    });

    it("should still cancel ours when every switch is off", async () => {
      await scheduleReminderPlan(input());

      await scheduleReminderPlan({ ...input({ settings: defaultReminderSettings }), inputs: null });

      expect(notificationsState.scheduled.size).toBe(0);
    });
  });

  describe("the variant last delivered", () => {
    const firstTrainVariant = async (): Promise<string | undefined> => {
      await scheduleReminderPlan(input({ settings: { ...everythingOn, progressEnabled: false } }));
      return (await readScheduledReminders()).find(
        ({ type, fireAt }) => type === "train" && Date.parse(fireAt) > NOW.getTime(),
      )?.variantId;
    };

    it("should keep the type, fire time and variant id of the plan, and nothing else", async () => {
      await scheduleReminderPlan(input());

      const stored = await readScheduledReminders();
      expect(stored.length).toBeGreaterThan(0);
      for (const entry of stored) {
        expect(Object.keys(entry).sort()).toEqual(["fireAt", "type", "variantId"]);
      }
      expect(mockStorageItems.get(scheduledRemindersStorageKey)).not.toContain(
        RECOGNISABLE_EXERCISE,
      );
    });

    it("should not repeat the variant of the latest reminder already delivered", async () => {
      const unconstrained = await firstTrainVariant();
      resetNotificationsMock();
      notificationsState.permission = "granted";
      mockStorageItems.set(
        scheduledRemindersStorageKey,
        JSON.stringify([
          { type: "train", fireAt: "2026-10-21T16:30:00.000Z", variantId: unconstrained },
        ]),
      );

      const afterDelivery = await firstTrainVariant();

      expect(afterDelivery).not.toBe(unconstrained);
    });

    it("should not count a stored reminder that is still ahead as delivered", async () => {
      const unconstrained = await firstTrainVariant();
      resetNotificationsMock();
      notificationsState.permission = "granted";
      mockStorageItems.set(
        scheduledRemindersStorageKey,
        JSON.stringify([
          { type: "train", fireAt: "2026-10-22T16:30:00.000Z", variantId: unconstrained },
        ]),
      );

      expect(await firstTrainVariant()).toBe(unconstrained);
    });

    it("should use the latest delivered of several, and keep it when the plan is stored again", async () => {
      const unconstrained = await firstTrainVariant();
      resetNotificationsMock();
      notificationsState.permission = "granted";
      mockStorageItems.set(
        scheduledRemindersStorageKey,
        JSON.stringify([
          { type: "train", fireAt: "2026-10-20T16:30:00.000Z", variantId: unconstrained },
          { type: "train", fireAt: "2026-10-21T16:30:00.000Z", variantId: "train-8" },
        ]),
      );

      await scheduleReminderPlan(input({ settings: { ...everythingOn, progressEnabled: false } }));

      const stored = await readScheduledReminders();
      expect(stored).toContainEqual({
        type: "train",
        fireAt: "2026-10-21T16:30:00.000Z",
        variantId: "train-8",
      });
      expect(stored).not.toContainEqual(
        expect.objectContaining({ fireAt: "2026-10-20T16:30:00.000Z" }),
      );
    });

    it("should fall back to the variant saved with the settings when none is known to be delivered", async () => {
      const unconstrained = await firstTrainVariant();
      resetNotificationsMock();
      notificationsState.permission = "granted";
      mockStorageItems.clear();

      await scheduleReminderPlan(
        input({
          settings: {
            ...everythingOn,
            progressEnabled: false,
            lastVariant: { ...defaultReminderSettings.lastVariant, train: unconstrained ?? null },
          },
        }),
      );

      const first = (await readScheduledReminders()).find(({ type }) => type === "train");
      expect(first?.variantId).not.toBe(unconstrained);
      expect(first?.fireAt).toBe("2026-10-22T16:30:00.000Z");
    });

    it("should read a damaged record as nothing delivered", async () => {
      mockStorageItems.set(scheduledRemindersStorageKey, "{not json");
      expect(await readScheduledReminders()).toEqual([]);

      mockStorageItems.set(
        scheduledRemindersStorageKey,
        JSON.stringify([
          { type: "walk", fireAt: "2026-10-21T16:30:00.000Z", variantId: "walk-1" },
          { type: "train", fireAt: "not a date", variantId: "train-1" },
          { type: "train", fireAt: "2026-10-21T16:30:00.000Z", variantId: 7 },
          { type: "train", fireAt: "2026-10-21T16:30:00.000Z", variantId: "train-2" },
        ]),
      );
      expect(await readScheduledReminders()).toEqual([
        { type: "train", fireAt: "2026-10-21T16:30:00.000Z", variantId: "train-2" },
      ]);
    });
  });

  describe("the health data rule", () => {
    it("should put no exercise, load or digit in any scheduled content, and the day's name in Time to train only", async () => {
      await scheduleReminderPlan(input());

      expect(notificationsState.scheduled.size).toBeGreaterThan(0);
      for (const { content } of notificationsState.scheduled.values()) {
        const words = `${content.title ?? ""} ${content.body ?? ""}`;
        expect(words).not.toContain(RECOGNISABLE_EXERCISE);
        expect(words.includes(RECOGNISABLE_DAY)).toBe(
          content.title === TRAINING_REMINDER_TITLES.train
            ? TRAIN_REMINDER_NAMES_ROUTINE_DAY
            : false,
        );
        const wordsWithoutDayName = words.replace(RECOGNISABLE_DAY, "");
        expect(wordsWithoutDayName).not.toMatch(/\d/);
        expect(words.toLowerCase()).not.toContain("chest");
      }
    });

    it("should keep the day's name out of the stored plan", async () => {
      await scheduleReminderPlan(input());

      expect([...mockStorageItems.values()].join(" ")).not.toContain(RECOGNISABLE_DAY);
    });

    it("should throw a fixed message, with no name or number in it, when the system refuses", async () => {
      mockExpoNotifications.scheduleNotificationAsync.mockRejectedValueOnce(
        new Error(`refused ${RECOGNISABLE_EXERCISE} ${RECOGNISABLE_LOAD}`),
      );

      const failure = await scheduleReminderPlan(input()).catch((error: unknown) => error);

      expect(failure).toEqual(new Error("A reminder could not be scheduled"));
    });

    it("should throw a fixed message when the plan cannot be made", async () => {
      const failure = await scheduleReminderPlan(
        input({ timeZone: `Nowhere/${RECOGNISABLE_DAY}` }),
      ).catch((error: unknown) => error);

      expect(String(failure)).not.toContain(RECOGNISABLE_DAY);
      expect(String(failure)).not.toMatch(/\d/);
    });
  });
});
