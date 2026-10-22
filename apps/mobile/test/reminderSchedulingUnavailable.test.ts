import { scheduleReminderPlan } from "../lib/reminderScheduler";
import { defaultReminderSettings } from "../lib/reminderSettings";

// A build made before expo-notifications was added has no native module, and loading the library throws.
jest.mock("expo-notifications", () => {
  throw new Error("Cannot find native module 'ExpoNotificationPermissionsModule'");
});
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
  },
}));

describe("scheduling the reminders on a build without the notifications module", () => {
  it("should do nothing, and not fail", async () => {
    await expect(
      scheduleReminderPlan({
        now: new Date("2026-10-22T09:00:00.000Z"),
        settings: { ...defaultReminderSettings, trainEnabled: true },
        inputs: {
          timeZone: "Europe/London",
          plan: { days: [{ weekday: 3, exercises: [] }] },
          sessions: [],
          heatSets: [],
          weeklyGain: false,
        },
      }),
    ).resolves.toBeUndefined();
  });
});
