import { renderHook, waitFor } from "@testing-library/react-native";

import { replaceReminders, replaceStreakNudge } from "../lib/notifications";
import { useCancelRemindersWhenSignedOut } from "../lib/reminderScheduler";
import {
  mockExpoNotifications,
  notificationsState,
  resetNotificationsMock,
} from "./support/expoNotificationsMock";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-notifications",
  () =>
    jest.requireActual<typeof import("./support/expoNotificationsMock")>(
      "./support/expoNotificationsMock",
    ).mockExpoNotifications,
);

const FUTURE = new Date("2099-01-01T19:00:00.000Z");

describe("cancelling what is scheduled when nobody is signed in", () => {
  beforeEach(() => {
    resetNotificationsMock();
  });

  it("should cancel the reminders and the streak nudge once signed out", async () => {
    await replaceReminders([
      { type: "train", fireAt: FUTURE, title: "T", body: "B", data: { type: "train" } },
    ]);
    await replaceStreakNudge({ fireAt: FUTURE, title: "T", body: "B" });
    expect(notificationsState.scheduled.size).toBe(2);

    await renderHook(() => {
      useCancelRemindersWhenSignedOut(true);
    });

    await waitFor(() => {
      expect(notificationsState.scheduled.size).toBe(0);
    });
  });

  it("should still cancel the streak nudge when cancelling the reminders fails", async () => {
    await replaceStreakNudge({ fireAt: FUTURE, title: "T", body: "B" });
    mockExpoNotifications.getAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error("no"));

    await renderHook(() => {
      useCancelRemindersWhenSignedOut(true);
    });

    await waitFor(() => {
      expect(notificationsState.scheduled.size).toBe(0);
    });
  });

  it("should cancel nothing while signed in", async () => {
    await replaceStreakNudge({ fireAt: FUTURE, title: "T", body: "B" });

    await renderHook(() => {
      useCancelRemindersWhenSignedOut(false);
    });

    expect(notificationsState.scheduled.size).toBe(1);
  });
});
