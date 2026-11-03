import { KeyLowProvider } from "@keylow/api-client";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { SetupScreen } from "../../../components/SetupScreen";
import { ToastProvider } from "../../../components/ui";
import { ThemeProvider } from "../../../lib/theme";
import { createDiaryQueryClient } from "../../support/diaryBackend";
import { resetRouterMock } from "../../support/expoRouterMock";
import { compileKitStyles } from "../../support/kitStyles";
import { registerAppStyles } from "../../support/nativeWindStyles";
import {
  resetSetupBackend,
  setupBackend,
  setupClient,
  signInSetupClient,
} from "../../support/setupBackend";

import type { SetupMode } from "../../../components/SetupScreen";
import type { QueryClient } from "@tanstack/react-query";

// The helpers every SetupScreen test file shares. Each file declares its own `jest.mock` calls, which
// Jest hoists only within the file that holds them, and then calls registerWizardHooks inside its
// describe.

// The region the device reports, which the units of the body step start from when the profile has none.
// Each test file's expo-localization mock reads it, so a test can change it.
export const deviceRegion: { current: string | null } = { current: "GB" };

// Moves the date the screen reads to the canvas's day and leaves every timer running.
const ONLY_THE_DATE = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

let queryClient: QueryClient;

export const wizard = (mode: SetupMode) => (
  <ThemeProvider fixedPreference="dark">
    <KeyLowProvider client={setupClient} queryClient={queryClient}>
      <ToastProvider>
        <SetupScreen mode={mode} />
      </ToastProvider>
    </KeyLowProvider>
  </ThemeProvider>
);

export async function renderWizard(mode: SetupMode) {
  queryClient = createDiaryQueryClient();
  await render(wizard(mode));
}

export const continueButton = () => screen.getByRole("button", { name: "Continue" });
export const backButton = () => screen.getByRole("button", { name: "Back" });
export const closeButton = () => screen.getByRole("button", { name: "Close" });
export const radio = (name: string | RegExp) => screen.getByRole("radio", { name });
export const preferNotToSay = /^Prefer not to say/;

export async function typeBirthDate(day: string, month: string, year: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Day of birth"), day);
  await user.type(screen.getByLabelText("Month of birth"), month);
  await user.type(screen.getByLabelText("Year of birth"), year);
}

// The handlers registered for the Android back button. The last one registered is asked first, and the
// first to say it handled the press stops it, as the platform does.
export const backPressHandlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];

export async function pressAndroidBackButton(): Promise<boolean> {
  let wasHandled = false;
  await act(() => {
    for (const handler of [...backPressHandlers].reverse()) {
      if (handler({ type: "hardwareBackPress", timeStamp: 0 }) === true) {
        wasHandled = true;
        return;
      }
    }
  });
  return wasHandled;
}

// Holds every write until the test lets go, so the screen can be looked at while a write is under way.
export function holdWritesNow(): () => Promise<void> {
  let release: () => void = () => undefined;
  setupBackend.writeGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return () =>
    act(() => {
      release();
    });
}

// The time zone the device reports, which the screen reads today's date in.
export function deviceTimeZone(timeZone: string) {
  jest
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockImplementation(() => ({ timeZone }) as Intl.ResolvedDateTimeFormatOptions);
}

export async function goToBodyStep(
  birthDate: readonly [string, string, string] = ["14", "03", "1991"],
) {
  const user = userEvent.setup();
  await goToBirthDateStep();
  await typeBirthDate(...birthDate);
  await user.press(continueButton());
}

export async function goToActivityStep(birthDate?: readonly [string, string, string]) {
  const user = userEvent.setup();
  await goToBodyStep(birthDate);
  await user.type(screen.getByLabelText("Height in centimetres"), "180");
  await user.type(screen.getByLabelText("Weight in kilograms"), "80");
  await user.press(continueButton());
}

export async function goToGoalStep(birthDate?: readonly [string, string, string]) {
  const user = userEvent.setup();
  await goToActivityStep(birthDate);
  await user.press(radio(/^Lightly active/));
  await user.press(continueButton());
}

export async function goToRateStep(goal: RegExp = /^Lose weight/) {
  const user = userEvent.setup();
  await goToGoalStep();
  await user.press(radio(goal));
  await user.press(continueButton());
}

export async function goToProteinStep() {
  const user = userEvent.setup();
  await goToRateStep();
  await user.press(continueButton());
}

// Past the diet to the estimate, for a person born on the day given who loses weight at the default rate.
export async function goToEstimate(birthDate: readonly [string, string, string]) {
  const user = userEvent.setup();
  await goToGoalStep(birthDate);
  await user.press(radio(/^Lose weight/));
  await user.press(continueButton());
  await user.press(continueButton());
  await user.press(continueButton());
  await user.press(continueButton());
}

export async function goToDietStep() {
  const user = userEvent.setup();
  await goToProteinStep();
  await user.press(continueButton());
}

export async function goToBirthDateStep() {
  const user = userEvent.setup();
  await user.press(radio("Male"));
  await user.press(continueButton());
}

export function registerWizardHooks() {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetupScreen"]);
  });

  beforeEach(async () => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetSetupBackend();
    backPressHandlers.length = 0;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler) => {
      backPressHandlers.push(handler);
      return {
        remove: () => {
          backPressHandlers.splice(backPressHandlers.indexOf(handler), 1);
        },
      };
    });
    deviceTimeZone("UTC");
    deviceRegion.current = "GB";
    jest.useFakeTimers({ now: new Date("2026-10-23T12:00:00Z"), doNotFake: [...ONLY_THE_DATE] });
    await signInSetupClient();
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });
}
