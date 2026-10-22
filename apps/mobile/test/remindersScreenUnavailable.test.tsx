import { REMINDERS_SCREEN } from "@keylow/core/copy";
import { render, screen, userEvent } from "@testing-library/react-native";

import RemindersRoute from "../app/reminders";
import { readReminderSettings } from "../lib/reminderSettings";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock } from "./support/expoRouterMock";

// An update can reach a build that was made before expo-notifications was added. Loading the library
// there throws, because its native module is missing.
jest.mock("expo-notifications", () => {
  throw new Error("Cannot find native module 'ExpoNotificationPermissionsModule'");
});
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

describe("the Reminders screen on a build without the notifications module", () => {
  beforeEach(() => {
    resetRouterMock();
  });

  it("should say a newer version must be installed, and disable the switches", async () => {
    await render(
      <ThemeProvider>
        <RemindersRoute />
      </ThemeProvider>,
    );

    expect(await screen.findByText(REMINDERS_SCREEN.unavailable.title)).toBeOnTheScreen();
    expect(screen.getByText(REMINDERS_SCREEN.unavailable.body)).toBeOnTheScreen();
    for (const { title } of REMINDERS_SCREEN.reminders) {
      expect(screen.getByRole("switch", { name: title })).toBeDisabled();
    }
    expect(screen.queryByText(REMINDERS_SCREEN.denied.title)).not.toBeOnTheScreen();
  });

  it("should turn nothing on when a switch is pressed", async () => {
    const user = userEvent.setup();
    await render(
      <ThemeProvider>
        <RemindersRoute />
      </ThemeProvider>,
    );
    await screen.findByText(REMINDERS_SCREEN.unavailable.title);

    await user.press(screen.getByRole("switch", { name: "Time to train" }));

    expect(screen.getByRole("switch", { name: "Time to train" })).not.toBeChecked();
    expect((await readReminderSettings()).trainEnabled).toBe(false);
  });
});
