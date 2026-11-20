import {
  cancelOurReminders,
  getPermission,
  onNotificationTap,
  postUnlockNotification,
  replaceStreakNudge,
  requestPermission,
  scheduleReminders,
  setUpReminderNotifications,
} from "../lib/notifications";

// An update can reach a build that was made before expo-notifications was added. Loading the library
// there throws, because its native module is missing.
jest.mock("expo-notifications", () => {
  throw new Error("Cannot find native module 'ExpoNotificationPermissionsModule'");
});

describe("reminder notifications on a build without the native module", () => {
  it("should report notifications as unavailable instead of failing", async () => {
    expect(await getPermission()).toBe("unavailable");
    expect(await requestPermission()).toBe("unavailable");
  });

  it("should do nothing when asked to schedule, cancel or set up", async () => {
    await expect(
      scheduleReminders([
        {
          type: "train",
          fireAt: new Date("2099-01-01T00:00:00.000Z"),
          title: "Title",
          body: "Body",
          data: { type: "train" },
        },
      ]),
    ).resolves.toBeUndefined();
    await expect(cancelOurReminders()).resolves.toBeUndefined();
    await expect(setUpReminderNotifications()).resolves.toBeUndefined();
  });

  it("should do nothing when asked to post an unlock or schedule the streak nudge", async () => {
    await expect(
      postUnlockNotification({ title: "Title", body: "Body", achievementId: "hat-trick" }),
    ).resolves.toBeUndefined();
    await expect(
      replaceStreakNudge({ fireAt: new Date("2099-01-01T00:00:00.000Z"), title: "T", body: "B" }),
    ).resolves.toBeUndefined();
    await expect(replaceStreakNudge(null)).resolves.toBeUndefined();
  });

  it("should give back an unsubscribe that does nothing when asked to listen for taps", () => {
    const unsubscribe = onNotificationTap(jest.fn());

    expect(() => {
      unsubscribe();
    }).not.toThrow();
  });
});
