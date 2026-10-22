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

import type { ReminderPlanInputs, ScheduleReminderPlanInput } from "../lib/reminderScheduler";

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
  Pick<Partial<ScheduleReminderPlanInput>, "settings">;

const input = ({
  settings = everythingOn,
  ...overrides
}: PlanInputOverrides = {}): ScheduleReminderPlanInput => ({
  now: NOW,
  settings,
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
            lastVariant: { train: unconstrained ?? null, progress: null, ease: null },
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
    it("should put no name, load or digit in any scheduled content", async () => {
      await scheduleReminderPlan(input());

      expect(notificationsState.scheduled.size).toBeGreaterThan(0);
      for (const { content } of notificationsState.scheduled.values()) {
        const words = `${content.title ?? ""} ${content.body ?? ""}`;
        expect(words).not.toContain(RECOGNISABLE_EXERCISE);
        expect(words).not.toContain(RECOGNISABLE_DAY);
        expect(words).not.toMatch(/\d/);
        expect(words.toLowerCase()).not.toContain("chest");
      }
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
