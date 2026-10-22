import { Platform } from "react-native";

import {
  cancelOurReminders,
  getPermission,
  onReminderTap,
  replaceReminders,
  requestPermission,
  scheduleReminders,
  setUpReminderNotifications,
} from "../lib/notifications";
import {
  leaveTapFromColdStart,
  mockExpoNotifications,
  notificationsState,
  resetNotificationsMock,
  tapNotification,
} from "./support/expoNotificationsMock";

import type { Reminder } from "../lib/notifications";

jest.mock(
  "expo-notifications",
  () =>
    jest.requireActual<typeof import("./support/expoNotificationsMock")>(
      "./support/expoNotificationsMock",
    ).mockExpoNotifications,
);

const now = new Date("2026-10-22T09:00:00.000Z");

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    type: "train",
    fireAt: new Date("2026-10-23T17:30:00.000Z"),
    title: "Title",
    body: "Body",
    data: { type: "train" },
    ...overrides,
  };
}

describe("reminder notifications", () => {
  beforeEach(() => {
    resetNotificationsMock();
    jest.useFakeTimers({ now });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("permission", () => {
    it("should report undetermined before the person has been asked", async () => {
      expect(await getPermission()).toBe("undetermined");
    });

    it("should report granted and denied as the system gives them", async () => {
      notificationsState.permission = "granted";
      expect(await getPermission()).toBe("granted");

      notificationsState.permission = "denied";
      expect(await getPermission()).toBe("denied");
    });

    it("should ask the system and return a grant", async () => {
      notificationsState.answerToRequest = "granted";

      expect(await requestPermission()).toBe("granted");
      expect(mockExpoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it("should return a refusal as denied", async () => {
      notificationsState.answerToRequest = "denied";

      expect(await requestPermission()).toBe("denied");
    });
  });

  describe("scheduling", () => {
    it("should schedule each reminder for its time on the reminder channel with its type in the data", async () => {
      const fireAt = new Date("2026-10-23T17:30:00.000Z");

      await scheduleReminders([reminder({ fireAt, title: "Train", body: "Today's session" })]);

      expect(mockExpoNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
        identifier: `keylow-reminder:train:${fireAt.getTime()}`,
        content: { title: "Train", body: "Today's session", data: { type: "train" } },
        trigger: { type: "date", date: fireAt, channelId: "reminders" },
      });
    });

    it("should leave out a reminder whose time has already passed", async () => {
      await scheduleReminders([
        reminder({ fireAt: new Date("2026-10-22T08:59:59.000Z") }),
        reminder({ type: "ease", data: { type: "ease" } }),
      ]);

      expect(mockExpoNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe("cancelling", () => {
    it("should cancel the reminders it scheduled and leave every other notification alone", async () => {
      await scheduleReminders([
        reminder(),
        reminder({ type: "progress", data: { type: "progress" } }),
      ]);
      await mockExpoNotifications.scheduleNotificationAsync({
        identifier: "someone-else",
        content: {},
        trigger: { type: "date", date: now },
      });

      await cancelOurReminders();

      expect([...notificationsState.scheduled.keys()]).toEqual(["someone-else"]);
    });
  });

  describe("replacing", () => {
    it("should leave only the second plan pending when two calls come in quick succession", async () => {
      const first = replaceReminders([reminder({ type: "train", data: { type: "train" } })]);
      const second = replaceReminders([reminder({ type: "ease", data: { type: "ease" } })]);
      await Promise.all([first, second]);

      const pending = [...notificationsState.scheduled.keys()];
      expect(pending).toHaveLength(1);
      expect(pending[0]).toContain("keylow-reminder:ease:");
    });

    it("should still run the next call when an earlier one fails", async () => {
      mockExpoNotifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error("failed"));

      await expect(replaceReminders([reminder()])).rejects.toThrow();
      await replaceReminders([reminder({ type: "ease", data: { type: "ease" } })]);

      expect([...notificationsState.scheduled.keys()]).toHaveLength(1);
    });
  });

  describe("what a notification carries", () => {
    // A reminder built carelessly, with the person's details beside the type.
    const careless = {
      ...reminder({ title: "Time to train", body: "Your session is waiting" }),
      data: { type: "train", name: "Marguerite", weightKg: "81.4", calories: "2150" },
    } as const;
    const details = ["Marguerite", "81.4", "2150"];

    it("should send the type and nothing else from the person's details in the data", async () => {
      await scheduleReminders([careless]);

      const [request] = [...notificationsState.scheduled.values()];
      expect(request?.content.data).toEqual({ type: "train" });
    });

    it("should carry no name or number beyond the identifier's time", async () => {
      await scheduleReminders([careless]);

      const [request] = [...notificationsState.scheduled.values()];
      const carried = JSON.stringify(request?.content);
      details.forEach((detail) => {
        expect(carried).not.toContain(detail);
      });
      expect(carried).not.toMatch(/\d/);
    });

    it("should not pass the system's error on, because it can quote the content", async () => {
      mockExpoNotifications.scheduleNotificationAsync.mockRejectedValueOnce(
        new Error("Could not schedule Marguerite, 81.4 kg, 2150 kcal"),
      );

      const failure: unknown = await scheduleReminders([careless]).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      const message = failure instanceof Error ? failure.message : "";
      details.forEach((detail) => {
        expect(message).not.toContain(detail);
      });
      expect(message).not.toMatch(/\d/);
    });
  });

  describe("tapping a reminder", () => {
    it("should hand the handler the type of the reminder that was tapped", () => {
      const handler = jest.fn();
      onReminderTap(handler);

      tapNotification("keylow-reminder:progress:1", { type: "progress" });

      expect(handler).toHaveBeenCalledWith("progress");
    });

    it("should ignore a notification that is not one of its reminders", () => {
      const handler = jest.fn();
      onReminderTap(handler);

      tapNotification("someone-else", { type: "train" });
      tapNotification("keylow-reminder:other:1", { type: "other" });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should stop calling the handler once unsubscribed", () => {
      const handler = jest.fn();
      const unsubscribe = onReminderTap(handler);

      unsubscribe();
      tapNotification("keylow-reminder:train:1", { type: "train" });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should hand over the tap that opened the app once, then clear it", () => {
      leaveTapFromColdStart("keylow-reminder:ease:1", { type: "ease" });
      const handler = jest.fn();

      onReminderTap(handler);
      onReminderTap(handler);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith("ease");
    });
  });

  describe("a tap that opened the app and cannot be read", () => {
    it("should still listen for taps, and not fail", () => {
      mockExpoNotifications.getLastNotificationResponse.mockImplementationOnce(() => {
        throw new TypeError("Cannot read properties of undefined");
      });
      const handler = jest.fn();

      expect(() => onReminderTap(handler)).not.toThrow();
      tapNotification("keylow-reminder:train:1", { type: "train" });

      expect(handler).toHaveBeenCalledWith("train");
    });
  });

  describe("set up", () => {
    afterEach(() => {
      Platform.OS = "ios";
    });

    it("should create the reminder channel on Android", async () => {
      Platform.OS = "android";

      await setUpReminderNotifications();

      expect(mockExpoNotifications.setNotificationChannelAsync).toHaveBeenCalledWith("reminders", {
        name: "Reminders",
        importance: 3,
      });
    });

    it("should not create a channel on iOS, which has none", async () => {
      Platform.OS = "ios";

      await setUpReminderNotifications();

      expect(mockExpoNotifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });

    it("should show a reminder that arrives while the app is open", async () => {
      await setUpReminderNotifications();

      const [handler] = mockExpoNotifications.setNotificationHandler.mock.calls[0] as [
        { handleNotification: () => Promise<Record<string, boolean>> },
      ];
      expect(await handler.handleNotification()).toMatchObject({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      });
    });
  });
});
