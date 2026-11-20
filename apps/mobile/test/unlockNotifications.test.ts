import { Platform } from "react-native";

import {
  onNotificationTap,
  postUnlockNotification,
  replaceReminders,
  replaceStreakNudge,
  setUpReminderNotifications,
} from "../lib/notifications";
import {
  leaveTapFromColdStart,
  mockExpoNotifications,
  notificationsState,
  resetNotificationsMock,
  tapNotification,
} from "./support/expoNotificationsMock";

jest.mock(
  "expo-notifications",
  () =>
    jest.requireActual<typeof import("./support/expoNotificationsMock")>(
      "./support/expoNotificationsMock",
    ).mockExpoNotifications,
);

const HEALTH_VALUES = ["81.4", "2150", "kcal", "kg"];

describe("unlock notifications", () => {
  beforeEach(() => {
    resetNotificationsMock();
  });

  describe("posting one", () => {
    it("should post the title and body it is given at once, on the achievements channel", async () => {
      await postUnlockNotification({
        title: "Badge earned: Hat Trick",
        body: "3-day daily streak. +10 points",
        achievementId: "hat-trick",
      });

      const [posted] = [...notificationsState.scheduled.values()];
      expect(posted?.content).toMatchObject({
        title: "Badge earned: Hat Trick",
        body: "3-day daily streak. +10 points",
      });
      expect(posted?.trigger).toEqual({ channelId: "achievements" });
    });

    it("should carry only the badge to open, and no health value", async () => {
      await postUnlockNotification({
        title: "Level 2 reached",
        body: "You reached Sapling",
        achievementId: null,
      });

      const [posted] = [...notificationsState.scheduled.values()];
      expect(posted?.content.data).toEqual({ kind: "unlock", achievementId: null });
      const everything = JSON.stringify(posted);
      HEALTH_VALUES.forEach((value) => {
        expect(everything).not.toContain(value);
      });
    });

    it("should raise a fixed message, not the system's, when it cannot post", async () => {
      mockExpoNotifications.scheduleNotificationAsync.mockRejectedValueOnce(
        new Error("Could not post Marguerite, 81.4 kg"),
      );

      const failure: unknown = await postUnlockNotification({
        title: "Badge earned: Hat Trick",
        body: "+10 points",
        achievementId: "hat-trick",
      }).catch((error: unknown) => error);

      expect(failure).toEqual(new Error("An unlock notification could not be posted"));
    });
  });

  describe("the channel", () => {
    afterEach(() => {
      Platform.OS = "ios";
    });

    it("should create the achievements channel named Badges and levels next to the reminders one on Android", async () => {
      Platform.OS = "android";

      await setUpReminderNotifications();

      expect(mockExpoNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        "reminders",
        expect.objectContaining({ name: "Reminders" }),
      );
      expect(mockExpoNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        "achievements",
        expect.objectContaining({ name: "Badges and levels" }),
      );
    });
  });

  describe("tapping one", () => {
    it("should hand the handler the badge that was tapped", () => {
      const handler = jest.fn();
      onNotificationTap(handler);

      tapNotification("keylow-unlock:1", { kind: "unlock", achievementId: "hat-trick" });

      expect(handler).toHaveBeenCalledWith({ kind: "unlock", achievementId: "hat-trick" });
    });

    it("should hand over a level-up alone as no badge", () => {
      const handler = jest.fn();
      onNotificationTap(handler);

      tapNotification("keylow-unlock:2", { kind: "unlock", achievementId: null });

      expect(handler).toHaveBeenCalledWith({ kind: "unlock", achievementId: null });
    });

    it("should hand over the tap that opened the app", () => {
      leaveTapFromColdStart("keylow-unlock:3", { kind: "unlock", achievementId: "hat-trick" });
      const handler = jest.fn();

      onNotificationTap(handler);

      expect(handler).toHaveBeenCalledWith({ kind: "unlock", achievementId: "hat-trick" });
    });

    it("should ignore an unlock whose badge is not one it knows", () => {
      const handler = jest.fn();
      onNotificationTap(handler);

      tapNotification("keylow-unlock:4", { kind: "unlock", achievementId: "../../etc" });
      tapNotification("somebody-else", { kind: "unlock", achievementId: "hat-trick" });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("the streak nudge", () => {
    const fireAt = new Date("2026-10-22T19:00:00.000Z");
    const nudge = {
      fireAt,
      title: "Keep your streak",
      body: "Complete today to keep your 12-day streak",
    };

    beforeEach(() => {
      jest.useFakeTimers({ now: new Date("2026-10-22T09:00:00.000Z") });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should schedule the nudge for its time on the achievements channel", async () => {
      await replaceStreakNudge(nudge);

      const [scheduled] = [...notificationsState.scheduled.values()];
      expect(scheduled?.content).toMatchObject({ title: nudge.title, body: nudge.body });
      expect(scheduled?.trigger).toMatchObject({ date: fireAt, channelId: "achievements" });
    });

    it("should replace the nudge it scheduled before, so there is one", async () => {
      await replaceStreakNudge(nudge);
      await replaceStreakNudge({ ...nudge, body: "Complete today to keep your 13-day streak" });

      expect(notificationsState.scheduled.size).toBe(1);
    });

    it("should cancel the nudge, and nothing else, when given none", async () => {
      await replaceStreakNudge(nudge);
      notificationsState.scheduled.set("keylow-reminder:train:1", {
        identifier: "keylow-reminder:train:1",
        content: {},
        trigger: { type: "date", date: fireAt },
      });

      await replaceStreakNudge(null);

      expect([...notificationsState.scheduled.keys()]).toEqual(["keylow-reminder:train:1"]);
    });

    it("should leave the nudge alone when the reminders are replaced", async () => {
      await replaceStreakNudge(nudge);

      await replaceReminders([]);

      expect(notificationsState.scheduled.size).toBe(1);
    });
  });
});
