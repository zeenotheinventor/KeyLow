import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";

import { notificationsState, resetNotificationsMock } from "./support/expoNotificationsMock";
import { REMINDER_DEBOUNCE_MILLISECONDS } from "../lib/reminderScheduler/useReminderScheduler";
import { useStreakNudgeScheduler } from "../lib/reminderScheduler/useStreakNudgeScheduler";
import { reminderSettingsStorageKey, useReminderSettings } from "../lib/reminderSettings";

import type { StreakNudgeInputs } from "../lib/reminderScheduler/useStreakNudgeInputs";
import type { AppStateStatus } from "react-native";

const mockStorageItems = new Map<string, string>();
let mockInputs: StreakNudgeInputs | null = null;
const mockInputsRead = jest.fn<undefined, [{ enabled: boolean }]>();
const mockInvalidate = jest.fn();

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
// The read has its own test. Here it is whatever the test says it is.
jest.mock("../lib/reminderScheduler/useStreakNudgeInputs", () => ({
  useStreakNudgeInputs: (options: { enabled: boolean }) => {
    mockInputsRead(options);
    return mockInputs;
  },
}));
jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));

// 2026-10-22 is a Thursday. London is on BST, so 20:00 there is 19:00 UTC, and 09:00 UTC is 10:00 there.
const NOW = new Date("2026-10-22T09:00:00.000Z");
const TONIGHT = "2026-10-22T19:00:00.000Z";

const atRisk: StreakNudgeInputs = {
  timeZone: "Europe/London",
  localDate: "2026-10-22",
  today: "at_risk",
  currentStreak: 12,
};

let appStateListener: (state: AppStateStatus) => void = () => undefined;

const scheduledNudges = () =>
  [...notificationsState.scheduled.values()].filter(({ identifier }) =>
    identifier.startsWith("keylow-streak-nudge:"),
  );

async function settle() {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(REMINDER_DEBOUNCE_MILLISECONDS);
  });
}

const saveSettings = (settings: object) => {
  mockStorageItems.set(reminderSettingsStorageKey, JSON.stringify(settings));
};

describe("the streak nudge scheduler", () => {
  beforeEach(() => {
    resetNotificationsMock();
    mockStorageItems.clear();
    mockInputs = atRisk;
    mockInputsRead.mockClear();
    mockInvalidate.mockClear();
    notificationsState.permission = "granted";
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

  it("should schedule the nudge for 8pm when the switch is on and today is not complete", async () => {
    saveSettings({ streakNudgeEnabled: true });

    await renderHook(() => {
      useStreakNudgeScheduler();
    });
    await settle();

    expect(scheduledNudges()).toHaveLength(1);
    expect(scheduledNudges()[0]?.content).toMatchObject({
      title: "Keep your streak",
      body: "Complete today to keep your 12-day streak",
    });
    expect(new Date(scheduledNudges()[0]?.trigger.date ?? 0).toISOString()).toBe(TONIGHT);
  });

  it("should schedule nothing, and read nothing, while the switch is off", async () => {
    await renderHook(() => {
      useStreakNudgeScheduler();
    });
    await settle();

    expect(scheduledNudges()).toEqual([]);
    expect(mockInputsRead).toHaveBeenLastCalledWith({ enabled: false });
  });

  it("should cancel the nudge when today is completed", async () => {
    saveSettings({ streakNudgeEnabled: true });
    const { rerender } = await renderHook(() => {
      useStreakNudgeScheduler();
    });
    await settle();
    expect(scheduledNudges()).toHaveLength(1);

    mockInputs = { ...atRisk, today: "complete" };
    await rerender(undefined);
    await settle();

    expect(scheduledNudges()).toEqual([]);
  });

  it("should not schedule on a day that is already complete", async () => {
    saveSettings({ streakNudgeEnabled: true });
    mockInputs = { ...atRisk, today: "complete" };

    await renderHook(() => {
      useStreakNudgeScheduler();
    });
    await settle();

    expect(scheduledNudges()).toEqual([]);
  });

  it("should cancel the nudge when the switch is turned off", async () => {
    saveSettings({ streakNudgeEnabled: true });
    const { result } = await renderHook(() => {
      useStreakNudgeScheduler();
      return useReminderSettings();
    });
    await settle();
    expect(scheduledNudges()).toHaveLength(1);

    await act(async () => {
      await result.current.update({ streakNudgeEnabled: false });
    });
    await settle();

    expect(scheduledNudges()).toEqual([]);
  });

  it("should schedule nothing when notifications are not allowed", async () => {
    saveSettings({ streakNudgeEnabled: true });
    notificationsState.permission = "denied";

    await renderHook(() => {
      useStreakNudgeScheduler();
    });
    await settle();

    expect(scheduledNudges()).toEqual([]);
  });

  it("should wait until the streak is read, and leave the schedule as it is", async () => {
    saveSettings({ streakNudgeEnabled: true });
    mockInputs = null;

    await renderHook(() => {
      useStreakNudgeScheduler();
    });
    await settle();

    expect(scheduledNudges()).toEqual([]);
  });

  it("should read the streak fresh and plan again when the app comes back", async () => {
    saveSettings({ streakNudgeEnabled: true });
    await renderHook(() => {
      useStreakNudgeScheduler();
    });
    await settle();
    notificationsState.scheduled.clear();

    await act(() => {
      appStateListener("active");
    });
    await settle();

    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    expect(scheduledNudges()).toHaveLength(1);
  });

  it("should read the streak fresh, and not plan again, when the app goes to the background", async () => {
    saveSettings({ streakNudgeEnabled: true });
    await renderHook(() => {
      useStreakNudgeScheduler();
    });
    await settle();
    notificationsState.scheduled.clear();

    await act(() => {
      appStateListener("background");
    });
    await settle();

    expect(mockInvalidate).toHaveBeenCalledTimes(1);
    expect(scheduledNudges()).toEqual([]);
  });
});
