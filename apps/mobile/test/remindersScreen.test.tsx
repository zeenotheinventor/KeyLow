import { REMINDERS_SCREEN } from "@keylow/core/copy";
import { render, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { Linking } from "react-native";

import RemindersRoute from "../app/reminders";
import { reminderSettingsStorageKey, readReminderSettings } from "../lib/reminderSettings";
import { ThemeProvider } from "../lib/theme";
import {
  mockExpoNotifications,
  notificationsState,
  resetNotificationsMock,
} from "./support/expoNotificationsMock";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

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
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

const [train, progress, ease] = REMINDERS_SCREEN.reminders;

let openSettings: jest.SpyInstance;

async function renderReminders() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider>
      <RemindersRoute />
    </ThemeProvider>,
  );
  return user;
}

const switchNamed = (name: string) => screen.getByRole("switch", { name });

describe("the Reminders screen", () => {
  beforeEach(() => {
    resetRouterMock();
    resetNotificationsMock();
    mockStorageItems.clear();
    openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("what it shows", () => {
    it("should be headed Reminders, with Back", async () => {
      const user = await renderReminders();

      expect(screen.getByRole("heading", { name: "Reminders" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back" }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to More on Back when nothing is before it", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderReminders();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
    });

    it("should draw the three switches in order, all off, each with its helper line", async () => {
      await renderReminders();

      expect(screen.getAllByRole("switch")).toEqual([
        switchNamed(train.title),
        switchNamed(progress.title),
        switchNamed(ease.title),
      ]);
      for (const reminder of [train, progress, ease]) {
        expect(switchNamed(reminder.title)).not.toBeChecked();
        expect(screen.getByText(reminder.helper)).toBeOnTheScreen();
      }
    });

    it("should show the saved switches on", async () => {
      mockStorageItems.set(
        reminderSettingsStorageKey,
        JSON.stringify({ trainEnabled: true, easeEnabled: true }),
      );
      await renderReminders();

      await waitFor(() => {
        expect(switchNamed(train.title)).toBeChecked();
      });
      expect(switchNamed(progress.title)).not.toBeChecked();
      expect(switchNamed(ease.title)).toBeChecked();
    });

    it("should show the train time, 17:30 until it is changed, in a labelled field", async () => {
      await renderReminders();

      expect(screen.getByRole("heading", { name: REMINDERS_SCREEN.timeHeading })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Time, 17:30, change" })).toBeOnTheScreen();
    });
  });

  describe("turning a reminder on", () => {
    it("should ask for the permission once, the first time, and turn it on when granted", async () => {
      const user = await renderReminders();

      await user.press(switchNamed(train.title));

      await waitFor(() => {
        expect(switchNamed(train.title)).toBeChecked();
      });
      expect(mockExpoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
      expect((await readReminderSettings()).trainEnabled).toBe(true);
    });

    it("should not ask again for the next switch once it is granted", async () => {
      const user = await renderReminders();
      await user.press(switchNamed(train.title));
      await waitFor(() => {
        expect(switchNamed(train.title)).toBeChecked();
      });

      await user.press(switchNamed(ease.title));

      await waitFor(() => {
        expect(switchNamed(ease.title)).toBeChecked();
      });
      expect(mockExpoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it("should not ask when the permission was granted already", async () => {
      notificationsState.permission = "granted";
      const user = await renderReminders();

      await user.press(switchNamed(progress.title));

      await waitFor(() => {
        expect(switchNamed(progress.title)).toBeChecked();
      });
      expect(mockExpoNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it("should keep the switch off and show the denied notice when the person refuses", async () => {
      notificationsState.answerToRequest = "denied";
      const user = await renderReminders();

      await user.press(switchNamed(train.title));

      expect(await screen.findByText(REMINDERS_SCREEN.denied.title)).toBeOnTheScreen();
      expect(screen.getByText(REMINDERS_SCREEN.denied.body)).toBeOnTheScreen();
      expect(switchNamed(train.title)).not.toBeChecked();
      expect((await readReminderSettings()).trainEnabled).toBe(false);
    });

    it("should open the phone's settings from the denied notice's button", async () => {
      notificationsState.permission = "denied";
      const user = await renderReminders();

      await user.press(await screen.findByRole("button", { name: "Open settings" }));

      expect(openSettings).toHaveBeenCalledTimes(1);
    });

    it("should go straight to the denied notice without asking when it was refused before", async () => {
      notificationsState.permission = "denied";
      const user = await renderReminders();
      await screen.findByText(REMINDERS_SCREEN.denied.title);

      await user.press(switchNamed(ease.title));

      expect(mockExpoNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(switchNamed(ease.title)).not.toBeChecked();
      expect(screen.getByText(REMINDERS_SCREEN.denied.title)).toBeOnTheScreen();
    });

    it("should show no notice when the permission is granted or not asked yet", async () => {
      await renderReminders();
      await waitFor(() => {
        expect(mockExpoNotifications.getPermissionsAsync).toHaveBeenCalled();
      });

      expect(screen.queryByText(REMINDERS_SCREEN.denied.title)).not.toBeOnTheScreen();
      expect(screen.queryByText(REMINDERS_SCREEN.unavailable.title)).not.toBeOnTheScreen();
    });
  });

  describe("turning a reminder off", () => {
    it("should turn it off and keep that, without asking for anything", async () => {
      notificationsState.permission = "granted";
      mockStorageItems.set(reminderSettingsStorageKey, JSON.stringify({ easeEnabled: true }));
      const user = await renderReminders();
      await waitFor(() => {
        expect(switchNamed(ease.title)).toBeChecked();
      });

      await user.press(switchNamed(ease.title));

      await waitFor(() => {
        expect(switchNamed(ease.title)).not.toBeChecked();
      });
      expect((await readReminderSettings()).easeEnabled).toBe(false);
      expect(mockExpoNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe("the train time", () => {
    async function chooseTime(
      user: ReturnType<typeof userEvent.setup>,
      hour: string,
      minute: string,
    ) {
      await user.press(screen.getByRole("button", { name: "Time, 17:30, change" }));
      await user.press(
        within(await screen.findByRole("spinbutton", { name: "Hours" })).getByRole("option", {
          name: hour,
        }),
      );
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Minutes" })).getByRole("option", {
          name: minute,
        }),
      );
    }

    it("should keep the time chosen in the picker and show it in the field", async () => {
      const user = await renderReminders();

      await chooseTime(user, "07", "45");
      await user.press(screen.getByRole("button", { name: "Done" }));

      expect(await screen.findByRole("button", { name: "Time, 07:45, change" })).toBeOnTheScreen();
      await waitFor(async () => {
        expect((await readReminderSettings()).trainTime).toBe("07:45");
      });
    });
  });
});
