import {
  cancelOurReminders,
  getPermission,
  onReminderTap,
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

  it("should give back an unsubscribe that does nothing when asked to listen for taps", () => {
    const unsubscribe = onReminderTap(jest.fn());

    expect(() => {
      unsubscribe();
    }).not.toThrow();
  });
});
