import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import { replaceReminders } from "../lib/notifications";
import {
  REMINDER_DEBOUNCE_MILLISECONDS,
  useReminderScheduler,
} from "../lib/reminderScheduler/useReminderScheduler";
import {
  defaultReminderSettings,
  reminderSettingsStorageKey,
  useReminderSettings,
} from "../lib/reminderSettings";
import { notificationsState, resetNotificationsMock } from "./support/expoNotificationsMock";

import type { ReminderPlanInputs } from "../lib/reminderScheduler";
import type { AppStateStatus } from "react-native";

const mockStorageItems = new Map<string, string>();
let mockPlanInputs: ReminderPlanInputs | null = null;

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
// The reads the plan is made from have their own tests. Here they are whatever the test says they are.
jest.mock("../lib/reminderScheduler/useReminderPlanInputs", () => ({
  useReminderPlanInputs: () => mockPlanInputs,
}));
jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
jest.mock("../lib/notifications", () => {
  const actual = jest.requireActual<typeof import("../lib/notifications")>("../lib/notifications");
  return { ...actual, replaceReminders: jest.fn(actual.replaceReminders) };
});

// 2026-10-22 is a Thursday. London is on BST, so 17:30 is 16:30 UTC, and 09:00 UTC is 10:00 there.
const NOW = new Date("2026-10-22T09:00:00.000Z");
const TODAYS_TRAIN = "2026-10-22T16:30:00.000Z";

const plannedDay = (weekday: number) => ({
  weekday,
  exercises: [{ muscles: [{ muscle_id: "chest_lower" as const, role: "primary" as const }] }],
});
const inputsWith = (overrides: Partial<ReminderPlanInputs> = {}): ReminderPlanInputs => ({
  timeZone: "Europe/London",
  plan: { days: [plannedDay(3), plannedDay(5)] },
  sessions: [],
  heatSets: [],
  weeklyGain: false,
  ...overrides,
});

const trainOn = { ...defaultReminderSettings, trainEnabled: true };
const saveSettings = (settings: object) => {
  mockStorageItems.set(reminderSettingsStorageKey, JSON.stringify(settings));
};

let appStateListener: (state: AppStateStatus) => void = () => undefined;

const fireAt = () =>
  [...notificationsState.scheduled.values()].map(({ trigger }) =>
    new Date(trigger.date).toISOString(),
  );

async function elapse(milliseconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(milliseconds);
  });
}
const settle = () => elapse(REMINDER_DEBOUNCE_MILLISECONDS);

describe("the reminder scheduler", () => {
  beforeEach(() => {
    resetNotificationsMock();
    mockStorageItems.clear();
    mockPlanInputs = inputsWith();
    notificationsState.permission = "granted";
    jest.mocked(replaceReminders).mockClear();
    jest.useFakeTimers({ now: NOW });
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      appStateListener = listener;
      return { remove: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("should plan once when the app opens, and schedule what the settings ask for", async () => {
    saveSettings(trainOn);

    await renderHook(() => {
      useReminderScheduler();
    });
    await settle();

    expect(replaceReminders).toHaveBeenCalledTimes(1);
    expect(fireAt()).toEqual([TODAYS_TRAIN, "2026-10-24T16:30:00.000Z"]);
  });

  it("should wait for the debounce before it plans", async () => {
    saveSettings(trainOn);

    await renderHook(() => {
      useReminderScheduler();
    });
    await elapse(REMINDER_DEBOUNCE_MILLISECONDS - 100);

    expect(replaceReminders).not.toHaveBeenCalled();
  });

  it("should plan again at the new time when the train time is changed", async () => {
    saveSettings(trainOn);
    const { result } = await renderHook(() => {
      useReminderScheduler();
      return useReminderSettings();
    });
    await settle();

    await act(async () => {
      await result.current.update({ trainTime: "18:15" });
    });
    await settle();

    expect(replaceReminders).toHaveBeenCalledTimes(2);
    expect(fireAt()).toEqual(["2026-10-22T17:15:00.000Z", "2026-10-24T17:15:00.000Z"]);
  });

  it("should plan again when the app comes back to the foreground", async () => {
    saveSettings(trainOn);
    await renderHook(() => {
      useReminderScheduler();
    });
    await settle();

    await act(() => {
      appStateListener("active");
    });
    await settle();

    expect(replaceReminders).toHaveBeenCalledTimes(2);
  });

  it("should not plan when the app goes to the background", async () => {
    saveSettings(trainOn);
    await renderHook(() => {
      useReminderScheduler();
    });
    await settle();

    await act(() => {
      appStateListener("background");
    });
    await settle();

    expect(replaceReminders).toHaveBeenCalledTimes(1);
  });

  it("should make one plan for triggers that land within a second of each other", async () => {
    saveSettings(trainOn);
    const { result } = await renderHook(() => {
      useReminderScheduler();
      return useReminderSettings();
    });
    await elapse(300);

    await act(async () => {
      await result.current.update({ progressEnabled: true });
    });
    await elapse(300);
    await act(() => {
      appStateListener("active");
    });
    await act(async () => {
      await result.current.update({ trainTime: "19:00" });
    });
    await settle();

    expect(replaceReminders).toHaveBeenCalledTimes(1);
    expect(fireAt()[0]).toBe("2026-10-22T18:00:00.000Z");
  });

  it("should drop today's train reminder as soon as a session is finished today", async () => {
    saveSettings(trainOn);
    const { rerender } = await renderHook(() => {
      useReminderScheduler();
    });
    await settle();
    expect(fireAt()).toContain(TODAYS_TRAIN);

    mockPlanInputs = inputsWith({
      sessions: [{ local_date: "2026-10-22", ended_at: "2026-10-22T09:00:00Z", deleted_at: null }],
    });
    await rerender(undefined);
    await settle();

    expect(fireAt()).toEqual(["2026-10-24T16:30:00.000Z"]);
  });

  it("should bring today's train reminder back when the finished session is discarded", async () => {
    saveSettings(trainOn);
    mockPlanInputs = inputsWith({
      sessions: [{ local_date: "2026-10-22", ended_at: "2026-10-22T09:00:00Z", deleted_at: null }],
    });
    const { rerender } = await renderHook(() => {
      useReminderScheduler();
    });
    await settle();

    mockPlanInputs = inputsWith();
    await rerender(undefined);
    await settle();

    expect(fireAt()).toContain(TODAYS_TRAIN);
  });

  it("should cancel ours and schedule nothing when every switch is off", async () => {
    notificationsState.scheduled.set("keylow-reminder:train:1", {
      identifier: "keylow-reminder:train:1",
      content: {},
      trigger: { type: "date", date: 1 },
    });

    await renderHook(() => {
      useReminderScheduler();
    });
    await settle();

    expect(notificationsState.scheduled.size).toBe(0);
    // The cancel goes through the queued replace, with nothing to schedule.
    expect(replaceReminders).toHaveBeenCalledTimes(1);
    expect(replaceReminders).toHaveBeenCalledWith([]);
  });

  it("should cancel ours and schedule nothing when the permission is not granted", async () => {
    saveSettings(trainOn);
    notificationsState.permission = "denied";
    notificationsState.scheduled.set("keylow-reminder:train:1", {
      identifier: "keylow-reminder:train:1",
      content: {},
      trigger: { type: "date", date: 1 },
    });

    await renderHook(() => {
      useReminderScheduler();
    });
    await settle();

    expect(notificationsState.scheduled.size).toBe(0);
    // The cancel goes through the queued replace, with nothing to schedule.
    expect(replaceReminders).toHaveBeenCalledTimes(1);
    expect(replaceReminders).toHaveBeenCalledWith([]);
  });

  it("should leave the schedule as it is while the inputs are not loaded", async () => {
    saveSettings(trainOn);
    mockPlanInputs = null;
    notificationsState.scheduled.set("keylow-reminder:train:1", {
      identifier: "keylow-reminder:train:1",
      content: {},
      trigger: { type: "date", date: 1 },
    });

    await renderHook(() => {
      useReminderScheduler();
    });
    await settle();

    expect(replaceReminders).not.toHaveBeenCalled();
    expect([...notificationsState.scheduled.keys()]).toEqual(["keylow-reminder:train:1"]);
  });

  it("should not plan before the saved settings have loaded", async () => {
    saveSettings(trainOn);

    await renderHook(() => {
      useReminderScheduler();
    });

    expect(replaceReminders).not.toHaveBeenCalled();
  });

  it("should not plan after it is unmounted", async () => {
    saveSettings(trainOn);
    const { unmount } = await renderHook(() => {
      useReminderScheduler();
    });
    await elapse(200);

    await unmount();
    await settle();

    expect(replaceReminders).not.toHaveBeenCalled();
  });

  it("should report a failure as one fixed line with no data in it", async () => {
    saveSettings(trainOn);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest
      .mocked(replaceReminders)
      .mockRejectedValueOnce(new Error("refused key511-recognisable-exercise 187.25"));

    await renderHook(() => {
      useReminderScheduler();
    });
    await settle();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("The reminders could not be scheduled");
  });
});
