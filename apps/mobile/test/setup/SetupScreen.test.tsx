import { KeyLowProvider } from "@keylow/api-client";
import { goldenCheckinFixture } from "@keylow/core/testing";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { SetupScreen } from "../../components/SetupScreen";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { pressTwiceInTheSameMoment } from "../support/sameTickPress";
import {
  freshProfile,
  measuredSnapshotRow,
  resetSetupBackend,
  savedProfile,
  savedProgram,
  setupBackend,
  setupClient,
  setupReads,
  signInSetupClient,
  startSnapshotRow,
  unmeasuredSnapshotRow,
  weighInHistoryRows,
} from "../support/setupBackend";

import type { SetupMode } from "../../components/SetupScreen";
import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
// The region the device reports, which the units of the body step start from when the profile has none.
let mockDeviceRegion: string | null = "GB";
jest.mock("expo-localization", () => ({
  getLocales: () => [{ regionCode: mockDeviceRegion }],
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

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

const wizard = (mode: SetupMode) => (
  <ThemeProvider fixedPreference="dark">
    <KeyLowProvider client={setupClient} queryClient={queryClient}>
      <ToastProvider>
        <SetupScreen mode={mode} />
      </ToastProvider>
    </KeyLowProvider>
  </ThemeProvider>
);

async function renderWizard(mode: SetupMode) {
  queryClient = createDiaryQueryClient();
  await render(wizard(mode));
}

const continueButton = () => screen.getByRole("button", { name: "Continue" });
const backButton = () => screen.getByRole("button", { name: "Back" });
const closeButton = () => screen.getByRole("button", { name: "Close" });
const radio = (name: string | RegExp) => screen.getByRole("radio", { name });
const preferNotToSay = /^Prefer not to say/;

async function typeBirthDate(day: string, month: string, year: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Day of birth"), day);
  await user.type(screen.getByLabelText("Month of birth"), month);
  await user.type(screen.getByLabelText("Year of birth"), year);
}

// The handlers registered for the Android back button. The last one registered is asked first, and the
// first to say it handled the press stops it, as the platform does.
const backPressHandlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];

async function pressAndroidBackButton(): Promise<boolean> {
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
function holdWritesNow(): () => Promise<void> {
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
function deviceTimeZone(timeZone: string) {
  jest
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockImplementation(() => ({ timeZone }) as Intl.ResolvedDateTimeFormatOptions);
}

async function goToBodyStep(birthDate: readonly [string, string, string] = ["14", "03", "1991"]) {
  const user = userEvent.setup();
  await goToBirthDateStep();
  await typeBirthDate(...birthDate);
  await user.press(continueButton());
}

async function goToActivityStep(birthDate?: readonly [string, string, string]) {
  const user = userEvent.setup();
  await goToBodyStep(birthDate);
  await user.type(screen.getByLabelText("Height in centimetres"), "180");
  await user.type(screen.getByLabelText("Weight in kilograms"), "80");
  await user.press(continueButton());
}

async function goToGoalStep(birthDate?: readonly [string, string, string]) {
  const user = userEvent.setup();
  await goToActivityStep(birthDate);
  await user.press(radio(/^Lightly active/));
  await user.press(continueButton());
}

async function goToRateStep(goal: RegExp = /^Lose weight/) {
  const user = userEvent.setup();
  await goToGoalStep();
  await user.press(radio(goal));
  await user.press(continueButton());
}

async function goToProteinStep() {
  const user = userEvent.setup();
  await goToRateStep();
  await user.press(continueButton());
}

// Past the diet to the estimate, for a person born on the day given who loses weight at the default rate.
async function goToEstimate(birthDate: readonly [string, string, string]) {
  const user = userEvent.setup();
  await goToGoalStep(birthDate);
  await user.press(radio(/^Lose weight/));
  await user.press(continueButton());
  await user.press(continueButton());
  await user.press(continueButton());
  await user.press(continueButton());
}

async function goToDietStep() {
  const user = userEvent.setup();
  await goToProteinStep();
  await user.press(continueButton());
}

async function goToBirthDateStep() {
  const user = userEvent.setup();
  await user.press(radio("Male"));
  await user.press(continueButton());
}

describe("the setup wizard", () => {
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
    mockDeviceRegion = "GB";
    jest.useFakeTimers({ now: new Date("2026-10-23T12:00:00Z"), doNotFake: [...ONLY_THE_DATE] });
    await signInSetupClient();
  });

  afterEach(async () => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    await cleanup();
    queryClient.clear();
  });

  describe("the first run, step 1", () => {
    it("should be titled About you, say Step 1 of 8 and ask What is your sex?", async () => {
      await renderWizard("first-run");

      expect(screen.getByRole("heading", { name: "About you" })).toBeOnTheScreen();
      expect(screen.getByText("Step 1 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 1 of 8" })).toHaveProp(
        "aria-valuenow",
        11,
      );
      expect(screen.getByRole("heading", { name: "What is your sex?" })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Ki-Lo uses it with your age, height and weight to estimate the energy you use each day.",
        ),
      ).toBeOnTheScreen();
    });

    it("should offer the three cards with nothing chosen and Continue disabled", async () => {
      await renderWizard("first-run");

      expect(screen.getAllByRole("radio")).toHaveLength(3);
      for (const card of screen.getAllByRole("radio")) {
        expect(card).not.toBeChecked();
      }
      expect(continueButton()).toBeDisabled();
    });

    it("should have no Back and no Close", async () => {
      await renderWizard("first-run");

      expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeOnTheScreen();
    });

    it("should enable Continue once Prefer not to say is chosen", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");

      await user.press(radio(preferNotToSay));

      expect(radio(preferNotToSay)).toBeChecked();
      expect(continueButton()).toBeEnabled();
    });

    it("should stay on step 1 when the disabled Continue is pressed", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");

      await user.press(continueButton());

      expect(screen.getByText("Step 1 of 8")).toBeOnTheScreen();
    });
  });

  describe("the first run escape", () => {
    const escapeButton = () => screen.getByRole("button", { name: "I'll set my own targets" });
    const savedBanner = () => screen.queryByText("Not saved. Check your connection and try again.");

    it("should be offered on step 1 of the first run, with nothing chosen and with a card chosen", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");

      expect(escapeButton()).toBeOnTheScreen();

      await user.press(radio("Female"));

      expect(escapeButton()).toBeOnTheScreen();
    });

    it("should not be offered on step 1 of a recalculation, which has Close", async () => {
      await renderWizard("recalculate");

      expect(
        screen.queryByRole("button", { name: "I'll set my own targets" }),
      ).not.toBeOnTheScreen();
    });

    it("should not be offered after step 1, where Back is the way out", async () => {
      await renderWizard("first-run");

      await goToBirthDateStep();

      expect(
        screen.queryByRole("button", { name: "I'll set my own targets" }),
      ).not.toBeOnTheScreen();
    });

    it("should mark the account set up with that one column and land on Targets", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");

      await user.press(escapeButton());

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith("/targets");
      });
      expect(routerMock.replace).toHaveBeenCalledTimes(1);
      expect(setupBackend.writes).toEqual(["PATCH profiles"]);
      expect(Object.keys(setupBackend.writeBodies["PATCH profiles"] ?? {})).toEqual([
        "onboarding_completed_at",
      ]);
    });

    it("should leave the wizard's own answers out of the write, whatever has been chosen", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await user.press(radio("Female"));

      await user.press(escapeButton());

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith("/targets");
      });
      expect(JSON.stringify(setupBackend.writeBodies["PATCH profiles"])).not.toContain("female");
    });

    it("should show the failed banner and stay on step 1 when the write fails", async () => {
      const user = userEvent.setup();
      setupBackend.writesFail = true;
      await renderWizard("first-run");

      await user.press(escapeButton());

      expect(
        await screen.findByText("Not saved. Check your connection and try again."),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "What is your sex?" })).toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(escapeButton()).toBeEnabled();
    });

    it("should show no raw error text when the write fails", async () => {
      const user = userEvent.setup();
      setupBackend.writesFail = true;
      await renderWizard("first-run");

      await user.press(escapeButton());

      await screen.findByText("Not saved. Check your connection and try again.");
      expect(screen.queryByText(/unavailable/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/XX000/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/Could not mark/)).not.toBeOnTheScreen();
    });

    it("should write again on the next press, and land on Targets once that works", async () => {
      const user = userEvent.setup();
      setupBackend.writesFail = true;
      await renderWizard("first-run");
      await user.press(escapeButton());
      await screen.findByText("Not saved. Check your connection and try again.");
      setupBackend.writesFail = false;

      await user.press(escapeButton());

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledWith("/targets");
      });
      expect(savedBanner()).not.toBeOnTheScreen();
    });

    it("should write once when it is pressed twice while the write is under way", async () => {
      await renderWizard("first-run");
      const release = holdWritesNow();

      await pressTwiceInTheSameMoment(escapeButton());
      await screen.findByRole("button", { busy: true });
      await release();

      await waitFor(() => {
        expect(routerMock.replace).toHaveBeenCalledTimes(1);
      });
      expect(setupBackend.writes).toEqual(["PATCH profiles"]);
    });

    it("should hold Continue still while the write is under way", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await user.press(radio("Female"));
      const release = holdWritesNow();

      await user.press(escapeButton());
      await screen.findByRole("button", { busy: true });
      await user.press(continueButton());

      expect(screen.getByRole("heading", { name: "What is your sex?" })).toBeOnTheScreen();
      await release();
    });

    it("should neither navigate nor fail loudly when the screen has gone before the write is done", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      const release = holdWritesNow();
      await user.press(escapeButton());
      await screen.findByRole("button", { busy: true });

      await screen.unmount();
      await release();
      await waitFor(() => {
        expect(setupBackend.writes).toEqual(["PATCH profiles"]);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(routerMock.replace).not.toHaveBeenCalled();
    });
  });

  describe("step 2, the birth date", () => {
    it("should follow step 1 with Back, no Close, and Continue disabled", async () => {
      await renderWizard("first-run");

      await goToBirthDateStep();

      expect(screen.getByRole("heading", { name: "About you" })).toBeOnTheScreen();
      expect(screen.getByText("Step 2 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 2 of 8" })).toHaveProp(
        "aria-valuenow",
        22,
      );
      expect(screen.getByRole("heading", { name: "When were you born?" })).toBeOnTheScreen();
      expect(screen.getByText("Your age is part of the estimate.")).toBeOnTheScreen();
      expect(backButton()).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeOnTheScreen();
      expect(continueButton()).toBeDisabled();
    });

    it("should say You are 35. for 14 03 1991 on 23 October 2026 and enable Continue", async () => {
      await renderWizard("first-run");
      await goToBirthDateStep();

      await typeBirthDate("14", "03", "1991");

      expect(screen.getByText("You are 35.")).toBeOnTheScreen();
      expect(continueButton()).toBeEnabled();
    });

    it("should refuse someone under 13 and keep Continue off", async () => {
      await renderWizard("first-run");
      await goToBirthDateStep();

      await typeBirthDate("02", "06", "2015");

      expect(screen.getByRole("alert")).toHaveTextContent(
        "You need to be 13 or over to use Ki-Lo.",
      );
      expect(continueButton()).toBeDisabled();
    });

    it("should refuse a future date and keep Continue off", async () => {
      await renderWizard("first-run");
      await goToBirthDateStep();

      await typeBirthDate("12", "11", "2026");

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a date before today.");
      expect(continueButton()).toBeDisabled();
    });

    it("should refuse 31 02 and keep Continue off", async () => {
      await renderWizard("first-run");
      await goToBirthDateStep();

      await typeBirthDate("31", "02", "1991");

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a real date.");
      expect(continueButton()).toBeDisabled();
    });

    it("should refuse a year that makes the person over 100 and keep Continue off", async () => {
      await renderWizard("first-run");
      await goToBirthDateStep();

      await typeBirthDate("01", "01", "1900");

      expect(screen.getByRole("alert")).toHaveTextContent("Enter a year from 1926 onwards.");
      expect(continueButton()).toBeDisabled();
    });

    it("should work out the age and the 13th birthday from the date in the device's time zone", async () => {
      // 12:00 in UTC is 01:00 on 24 October in Auckland, so someone born on 24 October 2013 is 13 there today.
      deviceTimeZone("Pacific/Auckland");
      await renderWizard("first-run");
      await goToBirthDateStep();

      await typeBirthDate("24", "10", "2013");

      expect(screen.getByText("You are 13.")).toBeOnTheScreen();
      expect(continueButton()).toBeEnabled();
    });

    it("should refuse that birth date where it is still 23 October", async () => {
      deviceTimeZone("UTC");
      await renderWizard("first-run");
      await goToBirthDateStep();

      await typeBirthDate("24", "10", "2013");

      expect(screen.getByRole("alert")).toHaveTextContent(
        "You need to be 13 or over to use Ki-Lo.",
      );
    });

    it("should write nothing about the answers to the console", async () => {
      const consoleCalls = [
        jest.spyOn(console, "log"),
        jest.spyOn(console, "info"),
        jest.spyOn(console, "warn"),
        jest.spyOn(console, "error"),
      ];
      await renderWizard("first-run");
      await goToBirthDateStep();

      await typeBirthDate("14", "03", "1991");

      expect(consoleCalls.flatMap((spy) => spy.mock.calls)).toEqual([]);
    });
  });

  describe("going on and back", () => {
    it("should keep the sex and the birth date when going Back and on again", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBirthDateStep();
      await typeBirthDate("14", "03", "1991");

      await user.press(backButton());

      expect(screen.getByText("Step 1 of 8")).toBeOnTheScreen();
      expect(radio("Male")).toBeChecked();
      expect(continueButton()).toBeEnabled();

      await user.press(continueButton());

      expect(screen.getByLabelText("Day of birth")).toHaveDisplayValue("14");
      expect(screen.getByLabelText("Month of birth")).toHaveDisplayValue("03");
      expect(screen.getByLabelText("Year of birth")).toHaveDisplayValue("1991");
      expect(screen.getByText("You are 35.")).toBeOnTheScreen();
      expect(continueButton()).toBeEnabled();
    });

    it("should keep the height, the weight and the units when going Back and on again", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBodyStep();
      await user.press(screen.getByRole("radio", { name: "lb, ft, in" }));
      await user.type(screen.getByLabelText("Height, feet"), "5");
      await user.type(screen.getByLabelText("Height, inches"), "11");
      await user.type(screen.getByLabelText("Weight in pounds"), "176.4");

      await user.press(backButton());
      await user.press(continueButton());

      expect(screen.getByRole("radio", { name: "lb, ft, in" })).toBeChecked();
      expect(screen.getByLabelText("Height, feet")).toHaveDisplayValue("5");
      expect(screen.getByLabelText("Height, inches")).toHaveDisplayValue("11");
      expect(screen.getByLabelText("Weight in pounds")).toHaveDisplayValue("176.4");
      expect(continueButton()).toBeEnabled();
    });

    it("should keep the activity and the goal when going Back and on again", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToGoalStep();
      await user.press(radio(/^Gain weight/));

      await user.press(backButton());
      expect(radio(/^Lightly active/)).toBeChecked();
      await user.press(continueButton());

      expect(radio(/^Gain weight/)).toBeChecked();
      expect(continueButton()).toBeEnabled();
    });
  });

  describe("step 3, height and weight", () => {
    const heightCentimetres = () => screen.getByLabelText("Height in centimetres");
    const weightKilograms = () => screen.getByLabelText("Weight in kilograms");

    it("should be titled About you, say Step 3 of 8 and ask How tall are you, and what do you weigh?", async () => {
      await renderWizard("first-run");

      await goToBodyStep();

      expect(screen.getByRole("heading", { name: "About you" })).toBeOnTheScreen();
      expect(screen.getByText("Step 3 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 3 of 8" })).toHaveProp(
        "aria-valuenow",
        33,
      );
      expect(
        screen.getByRole("heading", { name: "How tall are you, and what do you weigh?" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("Your weight this morning, before you eat, is best."),
      ).toBeOnTheScreen();
    });

    it("should open empty with Continue disabled on a fresh account", async () => {
      await renderWizard("first-run");

      await goToBodyStep();

      expect(heightCentimetres()).toHaveDisplayValue("");
      expect(weightKilograms()).toHaveDisplayValue("");
      expect(continueButton()).toBeDisabled();
    });

    it("should enable Continue once the height and the weight are valid", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBodyStep();

      await user.type(heightCentimetres(), "180");
      expect(continueButton()).toBeDisabled();
      await user.type(weightKilograms(), "80");

      expect(continueButton()).toBeEnabled();
    });

    it.each([
      ["a height of 90 cm", "90", "80", "Enter a height between 100 and 250 cm."],
      ["a height of 251 cm", "251", "80", "Enter a height between 100 and 250 cm."],
      ["a weight of 19.9 kg", "180", "19.9", "Enter a weight between 20 and 400 kg."],
      ["a weight of 400.1 kg", "180", "400.1", "Enter a weight between 20 and 400 kg."],
    ])("should show its line and keep Continue off for %s", async (_name, height, weight, line) => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBodyStep();

      await user.type(heightCentimetres(), height);
      await user.type(weightKilograms(), weight);

      expect(screen.getByRole("alert")).toHaveTextContent(line);
      expect(continueButton()).toBeDisabled();
    });

    it("should not move on when the disabled Continue is pressed", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBodyStep();

      await user.press(continueButton());

      expect(screen.getByText("Step 3 of 8")).toBeOnTheScreen();
    });

    describe("the units it opens in", () => {
      it("should open a US device with nothing stored in lb and ft and in", async () => {
        mockDeviceRegion = "US";
        await renderWizard("first-run");

        await goToBodyStep();

        expect(screen.getByRole("radio", { name: "lb, ft, in" })).toBeChecked();
        expect(screen.getByLabelText("Height, feet")).toBeOnTheScreen();
        expect(screen.getByLabelText("Height, inches")).toBeOnTheScreen();
        expect(screen.getByLabelText("Weight in pounds")).toBeOnTheScreen();
      });

      it("should open a GB device with nothing stored in kg and cm", async () => {
        await renderWizard("first-run");

        await goToBodyStep();

        expect(screen.getByRole("radio", { name: "kg, cm" })).toBeChecked();
        expect(heightCentimetres()).toBeOnTheScreen();
        expect(weightKilograms()).toBeOnTheScreen();
      });

      it("should open a stored st in lb, because there are no stones in the wizard", async () => {
        setupBackend.profile = { ...freshProfile, weight_unit: "st" };
        await renderWizard("first-run");
        await goToBodyStep();

        expect(await screen.findByLabelText("Weight in pounds")).toBeOnTheScreen();
        expect(screen.getByRole("radio", { name: "lb, ft, in" })).toBeChecked();
      });

      it("should open a stored kg in kg whatever the region", async () => {
        mockDeviceRegion = "US";
        setupBackend.profile = { ...freshProfile, weight_unit: "kg" };
        await renderWizard("first-run");
        await goToBodyStep();

        expect(await screen.findByLabelText("Weight in kilograms")).toBeOnTheScreen();
        expect(screen.getByRole("radio", { name: "kg, cm" })).toBeChecked();
      });

      it("should keep a stored unit when the switch is used, which only changes the entry units", async () => {
        const user = userEvent.setup();
        setupBackend.profile = { ...freshProfile, weight_unit: "kg" };
        await renderWizard("first-run");
        await goToBodyStep();
        await screen.findByLabelText("Weight in kilograms");

        await user.press(screen.getByRole("radio", { name: "lb, ft, in" }));

        expect(screen.getByLabelText("Weight in pounds")).toBeOnTheScreen();
        expect(setupBackend.writes).toEqual([]);
      });
    });

    describe("prefilled from what is saved", () => {
      beforeEach(() => {
        setupBackend.profile = savedProfile;
        setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-21" };
      });

      it("should show the saved height and the weight of the latest weigh-in with its source line", async () => {
        const user = userEvent.setup();
        await renderWizard("recalculate");
        await screen.findByRole("radio", { name: "Male", checked: true });
        await user.press(continueButton());
        await user.press(continueButton());

        expect(heightCentimetres()).toHaveDisplayValue("180");
        expect(weightKilograms()).toHaveDisplayValue("80.0");
        expect(screen.getByText("From your weigh-in on 21 Oct")).toBeOnTheScreen();
        expect(continueButton()).toBeEnabled();
      });

      it("should say today for a weigh-in made today", async () => {
        const user = userEvent.setup();
        setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-23" };
        await renderWizard("recalculate");
        await screen.findByRole("radio", { name: "Male", checked: true });
        await user.press(continueButton());
        await user.press(continueButton());

        expect(screen.getByText("From your weigh-in today")).toBeOnTheScreen();
      });

      it("should use a weigh-in of any date, however old", async () => {
        const user = userEvent.setup();
        setupBackend.weighIn = { weight_kg: 63.4, local_date: "2024-02-03" };
        await renderWizard("recalculate");
        await screen.findByRole("radio", { name: "Male", checked: true });
        await user.press(continueButton());
        await user.press(continueButton());

        expect(weightKilograms()).toHaveDisplayValue("63.4");
        expect(screen.getByText("From your weigh-in on 3 Feb")).toBeOnTheScreen();
      });

      it("should leave the weight empty, with no source line, when there is no weigh-in", async () => {
        const user = userEvent.setup();
        setupBackend.weighIn = null;
        await renderWizard("recalculate");
        await screen.findByRole("radio", { name: "Male", checked: true });
        await user.press(continueButton());
        await user.press(continueButton());

        expect(heightCentimetres()).toHaveDisplayValue("180");
        expect(weightKilograms()).toHaveDisplayValue("");
        expect(screen.queryByText(/^From your weigh-in/)).not.toBeOnTheScreen();
        expect(continueButton()).toBeDisabled();
      });

      it("should say a saved height outside the bounds is wrong and keep Continue off", async () => {
        const user = userEvent.setup();
        setupBackend.profile = { ...savedProfile, height_cm: 90 };
        await renderWizard("recalculate");
        await screen.findByRole("radio", { name: "Male", checked: true });
        await user.press(continueButton());
        await user.press(continueButton());

        expect(heightCentimetres()).toHaveDisplayValue("90");
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Enter a height between 100 and 250 cm.",
        );
        expect(continueButton()).toBeDisabled();
      });

      it("should show the weigh-in in pounds to one decimal for a stored lb", async () => {
        const user = userEvent.setup();
        setupBackend.profile = { ...savedProfile, weight_unit: "lb" };
        await renderWizard("recalculate");
        await screen.findByRole("radio", { name: "Male", checked: true });
        await user.press(continueButton());
        await user.press(continueButton());

        expect(screen.getByLabelText("Weight in pounds")).toHaveDisplayValue("176.4");
        expect(screen.getByLabelText("Height, feet")).toHaveDisplayValue("5");
        expect(screen.getByLabelText("Height, inches")).toHaveDisplayValue("11");
        expect(screen.getByText("From your weigh-in on 21 Oct")).toBeOnTheScreen();
      });

      it("should remove the source line once the weight is changed", async () => {
        const user = userEvent.setup();
        await renderWizard("recalculate");
        await screen.findByRole("radio", { name: "Male", checked: true });
        await user.press(continueButton());
        await user.press(continueButton());

        await user.clear(weightKilograms());
        await user.type(weightKilograms(), "81.5");

        expect(screen.queryByText(/^From your weigh-in/)).not.toBeOnTheScreen();
      });

      it("should keep the source line through a switch of units and back", async () => {
        const user = userEvent.setup();
        await renderWizard("recalculate");
        await screen.findByRole("radio", { name: "Male", checked: true });
        await user.press(continueButton());
        await user.press(continueButton());

        await user.press(screen.getByRole("radio", { name: "lb, ft, in" }));
        expect(screen.getByLabelText("Weight in pounds")).toHaveDisplayValue("176.4");
        await user.press(screen.getByRole("radio", { name: "kg, cm" }));

        expect(weightKilograms()).toHaveDisplayValue("80.0");
        expect(screen.getByText("From your weigh-in on 21 Oct")).toBeOnTheScreen();
      });

      it("should fill the fields when the saved answers arrive after step 3 opened", async () => {
        const user = userEvent.setup();
        let release: () => void = () => undefined;
        setupBackend.readGate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await renderWizard("recalculate");
        await user.press(radio("Female"));
        await user.press(continueButton());
        await typeBirthDate("14", "03", "1991");
        await user.press(continueButton());
        expect(heightCentimetres()).toHaveDisplayValue("");

        await act(() => {
          release();
        });

        expect(await screen.findByDisplayValue("180")).toBeOnTheScreen();
        expect(weightKilograms()).toHaveDisplayValue("80.0");
        expect(screen.getByText("From your weigh-in on 21 Oct")).toBeOnTheScreen();
      });

      it("should leave what is typed alone, and take nothing, when the saved answers arrive after typing", async () => {
        const user = userEvent.setup();
        let release: () => void = () => undefined;
        setupBackend.readGate = new Promise<void>((resolve) => {
          release = resolve;
        });
        // A saved Maintain goal makes the count read of 7 once the saved answers have joined the draft.
        setupBackend.program = { ...savedProgram, goal: "maintain", rate_pct_per_week: 0 };
        await renderWizard("recalculate");
        await user.press(radio("Female"));
        await user.press(continueButton());
        await typeBirthDate("14", "03", "1991");
        await user.press(continueButton());
        await user.type(heightCentimetres(), "17", { skipBlur: true });

        await act(() => {
          release();
        });

        expect(await screen.findByText("Step 3 of 7")).toBeOnTheScreen();
        expect(heightCentimetres()).toHaveDisplayValue("17");
        expect(weightKilograms()).toHaveDisplayValue("");
        expect(screen.queryByText(/^From your weigh-in/)).not.toBeOnTheScreen();
        // What the fields show is what the draft holds: a saved height and weight under them would let Continue through.
        expect(continueButton()).toBeDisabled();
      });
    });

    it("should write nothing, not a profile and not a weigh-in, from this step", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBodyStep();

      await user.type(heightCentimetres(), "180");
      await user.type(weightKilograms(), "80");
      await user.press(continueButton());

      expect(setupBackend.writes).toEqual([]);
    });

    it("should write nothing about the height or the weight to the console", async () => {
      const consoleCalls = [
        jest.spyOn(console, "log"),
        jest.spyOn(console, "info"),
        jest.spyOn(console, "warn"),
        jest.spyOn(console, "error"),
      ];
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBodyStep();

      await user.type(heightCentimetres(), "18");
      await user.type(weightKilograms(), "81.45");
      await user.press(screen.getByRole("radio", { name: "lb, ft, in" }));

      expect(consoleCalls.flatMap((spy) => spy.mock.calls)).toEqual([]);
    });
  });

  describe("step 4, activity", () => {
    it("should be titled Activity, say Step 4 of 8 and ask How active are you?", async () => {
      await renderWizard("first-run");

      await goToActivityStep();

      expect(screen.getByRole("heading", { name: "Activity" })).toBeOnTheScreen();
      expect(screen.getByText("Step 4 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 4 of 8" })).toHaveProp(
        "aria-valuenow",
        44,
      );
      expect(screen.getByRole("heading", { name: "How active are you?" })).toBeOnTheScreen();
      expect(
        screen.getByText("Think of a normal week: your job, getting about and exercise."),
      ).toBeOnTheScreen();
      expect(backButton()).toBeOnTheScreen();
    });

    it("should offer the five levels in a group named by the question, with nothing chosen and Continue disabled", async () => {
      await renderWizard("first-run");

      await goToActivityStep();

      expect(screen.getByLabelText("How active are you?")).toHaveProp("role", "radiogroup");
      expect(screen.getAllByRole("radio")).toHaveLength(5);
      for (const card of screen.getAllByRole("radio")) {
        expect(card).not.toBeChecked();
      }
      expect(continueButton()).toBeDisabled();
    });

    it("should enable Continue once a level is chosen, and go to the goal", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToActivityStep();

      await user.press(radio(/^Moderately active/));

      expect(radio(/^Moderately active/)).toBeChecked();
      expect(continueButton()).toBeEnabled();
      await user.press(continueButton());
      expect(screen.getByText("Step 5 of 8")).toBeOnTheScreen();
    });

    it("should go Back to the height and weight with them kept", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToActivityStep();

      await user.press(backButton());

      expect(screen.getByText("Step 3 of 8")).toBeOnTheScreen();
      expect(screen.getByLabelText("Height in centimetres")).toHaveDisplayValue("180");
      expect(screen.getByLabelText("Weight in kilograms")).toHaveDisplayValue("80.0");
    });
  });

  describe("step 5, goal", () => {
    it("should be titled Goal, say Step 5 of 8 and ask What is your goal?", async () => {
      await renderWizard("first-run");

      await goToGoalStep();

      expect(screen.getByRole("heading", { name: "Goal" })).toBeOnTheScreen();
      expect(screen.getByText("Step 5 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 5 of 8" })).toHaveProp(
        "aria-valuenow",
        56,
      );
      expect(screen.getByRole("heading", { name: "What is your goal?" })).toBeOnTheScreen();
      expect(screen.getByText("Your calorie target follows from this.")).toBeOnTheScreen();
    });

    it("should offer Lose, Maintain and Gain weight with nothing chosen and Continue disabled", async () => {
      await renderWizard("first-run");

      await goToGoalStep();

      expect(screen.getByLabelText("What is your goal?")).toHaveProp("role", "radiogroup");
      expect(screen.getAllByRole("radio")).toHaveLength(3);
      for (const card of screen.getAllByRole("radio")) {
        expect(card).not.toBeChecked();
        expect(card).toBeEnabled();
      }
      expect(continueButton()).toBeDisabled();
    });

    it("should always show the pregnancy and breastfeeding note for an adult", async () => {
      await renderWizard("first-run");

      await goToGoalStep();

      expect(screen.getByText("Pregnant or breastfeeding?")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Talk to a doctor, midwife or dietitian before you set a goal. Ki-Lo's estimates do not allow for pregnancy or breastfeeding.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText("Talk to a health professional")).not.toBeOnTheScreen();
    });

    it("should draw the note under the cards, as the board does", async () => {
      await renderWizard("first-run");

      await goToGoalStep();

      const tree = JSON.stringify(screen.toJSON());
      expect(tree.indexOf("Gain weight")).toBeGreaterThan(-1);
      expect(tree.indexOf("Pregnant or breastfeeding?")).toBeGreaterThan(
        tree.lastIndexOf("Eat a little more than you use."),
      );
    });

    it("should enable Continue once a goal is chosen", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToGoalStep();

      await user.press(radio(/^Lose weight/));

      expect(radio(/^Lose weight/)).toBeChecked();
      expect(continueButton()).toBeEnabled();
    });

    describe("for someone aged 16", () => {
      const sixteen = ["02", "06", "2010"] as const;

      it("should draw Lose weight disabled, with its reason and its name, and the under 18 note", async () => {
        await renderWizard("first-run");

        await goToGoalStep(sixteen);

        expect(
          screen.getByRole("radio", { name: "Lose weight, Not offered under 18" }),
        ).toBeDisabled();
        expect(screen.getByText("Not offered under 18.")).toBeOnTheScreen();
        expect(screen.getByText("Talk to a health professional")).toBeOnTheScreen();
        expect(
          screen.getByText(
            "If you are under 18 and want to lose weight, or you are pregnant or breastfeeding, talk to a doctor, midwife or dietitian first.",
          ),
        ).toBeOnTheScreen();
        expect(screen.queryByText("Pregnant or breastfeeding?")).not.toBeOnTheScreen();
      });

      it("should do nothing when Lose weight is pressed", async () => {
        const user = userEvent.setup();
        await renderWizard("first-run");
        await goToGoalStep(sixteen);

        await user.press(screen.getByRole("radio", { name: "Lose weight, Not offered under 18" }));

        for (const card of screen.getAllByRole("radio")) {
          expect(card).not.toBeChecked();
        }
        expect(continueButton()).toBeDisabled();
      });

      it("should read Step 5 of 8 until Maintain is chosen and Step 5 of 7 from then on", async () => {
        const user = userEvent.setup();
        await renderWizard("first-run");
        await goToGoalStep(sixteen);
        expect(screen.getByText("Step 5 of 8")).toBeOnTheScreen();

        await user.press(radio(/^Maintain weight/));

        expect(screen.getByText("Step 5 of 7")).toBeOnTheScreen();
        expect(screen.getByRole("progressbar", { name: "Step 5 of 7" })).toHaveProp(
          "aria-valuenow",
          63,
        );
      });

      it("should still let Gain weight be chosen", async () => {
        const user = userEvent.setup();
        await renderWizard("first-run");
        await goToGoalStep(sixteen);

        await user.press(radio(/^Gain weight/));

        expect(radio(/^Gain weight/)).toBeChecked();
        expect(continueButton()).toBeEnabled();
      });
    });

    describe("for someone who is 18 today", () => {
      it("should offer Lose weight", async () => {
        await renderWizard("first-run");

        await goToGoalStep(["23", "10", "2008"]);

        expect(radio(/^Lose weight, Eat a little less than you use/)).toBeEnabled();
        expect(screen.getByText("Pregnant or breastfeeding?")).toBeOnTheScreen();
      });
    });

    describe("for someone who is 18 tomorrow", () => {
      it("should not offer Lose weight", async () => {
        await renderWizard("first-run");

        await goToGoalStep(["24", "10", "2008"]);

        expect(
          screen.getByRole("radio", { name: "Lose weight, Not offered under 18" }),
        ).toBeDisabled();
      });
    });
  });

  describe("step 6, the rate", () => {
    it("should be titled Goal, say Step 6 of 8 and ask How fast do you want to lose weight?", async () => {
      await renderWizard("first-run");

      await goToRateStep();

      expect(screen.getByRole("heading", { name: "Goal" })).toBeOnTheScreen();
      expect(screen.getByText("Step 6 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 6 of 8" })).toHaveProp(
        "aria-valuenow",
        67,
      );
      expect(
        screen.getByRole("heading", { name: "How fast do you want to lose weight?" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("As a share of your body weight each week. Slower is easier to keep up."),
      ).toBeOnTheScreen();
    });

    it("should offer the four lose rates with 0.5 percent chosen on arrival, marked Suggested, and Continue live", async () => {
      await renderWizard("first-run");

      await goToRateStep();

      expect(screen.getByLabelText("How fast do you want to lose weight?")).toHaveProp(
        "role",
        "radiogroup",
      );
      expect(screen.getAllByRole("radio")).toHaveLength(4);
      expect(
        screen.getByRole("radio", {
          name: "0.5% a week, Suggested, A steady pace, about 0.4 kilograms a week",
        }),
      ).toBeChecked();
      expect(screen.getAllByText("Suggested")).toHaveLength(1);
      expect(continueButton()).toBeEnabled();
    });

    it("should write the lose amounts at 80 kg as 0.2, 0.4, 0.6 and 0.8 kg", async () => {
      await renderWizard("first-run");

      await goToRateStep();

      for (const amount of ["0.2 kg", "0.4 kg", "0.6 kg", "0.8 kg"]) {
        expect(screen.getByText(amount)).toBeOnTheScreen();
      }
    });

    it("should write the lose amounts at 176.4 lb as 0.4, 0.9, 1.3 and 1.8 lb", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBodyStep();
      await user.press(screen.getByRole("radio", { name: "lb, ft, in" }));
      await user.type(screen.getByLabelText("Height, feet"), "5");
      await user.type(screen.getByLabelText("Height, inches"), "11");
      await user.type(screen.getByLabelText("Weight in pounds"), "176.4");
      await user.press(continueButton());
      await user.press(radio(/^Lightly active/));
      await user.press(continueButton());
      await user.press(radio(/^Lose weight/));
      await user.press(continueButton());

      for (const amount of ["0.4 lb", "0.9 lb", "1.3 lb", "1.8 lb"]) {
        expect(screen.getByText(amount)).toBeOnTheScreen();
      }
    });

    it("should offer the three gain rates, with 0.25 percent chosen and Suggested, and 0.1, 0.2 and 0.4 kg", async () => {
      await renderWizard("first-run");

      await goToRateStep(/^Gain weight/);

      expect(
        screen.getByRole("heading", { name: "How fast do you want to gain weight?" }),
      ).toBeOnTheScreen();
      expect(
        screen.getByText("As a share of your body weight each week. Slower gains add less fat."),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(
        screen.getByRole("radio", {
          name: "0.25% a week, Suggested, A steady pace, about 0.2 kilograms a week",
        }),
      ).toBeChecked();
      for (const amount of ["0.1 kg", "0.2 kg", "0.4 kg"]) {
        expect(screen.getByText(amount)).toBeOnTheScreen();
      }
    });

    it("should reset the rate to 0.25 and mark it Suggested when the goal is changed from lose to gain", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToRateStep();
      await user.press(radio(/^1\.0% a week/));

      await user.press(backButton());
      await user.press(radio(/^Gain weight/));
      await user.press(continueButton());

      expect(radio(/^0\.25% a week, Suggested/)).toBeChecked();
      expect(radio(/^0\.1% a week/)).not.toBeChecked();
    });

    it("should keep the rate chosen when going Back to the goal and on again without changing it", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToRateStep();
      await user.press(radio(/^1\.0% a week/));

      await user.press(backButton());
      await user.press(continueButton());

      expect(radio(/^1\.0% a week/)).toBeChecked();
    });

    it("should go on to the protein with Continue and come Back to the rate", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToRateStep();
      await user.press(radio(/^0\.75% a week/));

      await user.press(continueButton());
      expect(screen.getByText("Step 7 of 8")).toBeOnTheScreen();
      await user.press(backButton());

      expect(screen.getByText("Step 6 of 8")).toBeOnTheScreen();
      expect(radio(/^0\.75% a week/)).toBeChecked();
    });
  });

  describe("Maintain", () => {
    it("should go from the goal straight to the protein, reading Step 6 of 7", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToGoalStep();
      await user.press(radio(/^Maintain weight/));
      expect(screen.getByText("Step 5 of 7")).toBeOnTheScreen();

      await user.press(continueButton());

      expect(screen.getByRole("heading", { name: "Macros" })).toBeOnTheScreen();
      expect(screen.getByText("Step 6 of 7")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "How much protein?" })).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 6 of 7" })).toHaveProp(
        "aria-valuenow",
        75,
      );
    });

    it("should go Back from the protein to the goal, with Maintain still chosen", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToGoalStep();
      await user.press(radio(/^Maintain weight/));
      await user.press(continueButton());

      await user.press(backButton());

      expect(screen.getByText("Step 5 of 7")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "What is your goal?" })).toBeOnTheScreen();
      expect(radio(/^Maintain weight/)).toBeChecked();
    });
  });

  describe("step 7, protein", () => {
    it("should be titled Macros, say Step 7 of 8 and ask How much protein?", async () => {
      await renderWizard("first-run");

      await goToProteinStep();

      expect(screen.getByRole("heading", { name: "Macros" })).toBeOnTheScreen();
      expect(screen.getByText("Step 7 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 7 of 8" })).toHaveProp(
        "aria-valuenow",
        78,
      );
      expect(screen.getByRole("heading", { name: "How much protein?" })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Ki-Lo sets protein first, from your weight, then shares the rest between fat and carbohydrate.",
        ),
      ).toBeOnTheScreen();
    });

    it("should offer three presets with Moderate chosen on arrival and Continue live", async () => {
      await renderWizard("first-run");

      await goToProteinStep();

      expect(screen.getByLabelText("How much protein?")).toHaveProp("role", "radiogroup");
      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(radio(/^Moderate/)).toBeChecked();
      expect(radio(/^High/)).not.toBeChecked();
      expect(continueButton()).toBeEnabled();
    });

    it("should write the grams at 80 kg as 128, 160 and 176 g a day", async () => {
      await renderWizard("first-run");

      await goToProteinStep();

      for (const grams of ["128 g", "160 g", "176 g"]) {
        expect(screen.getByText(grams)).toBeOnTheScreen();
      }
    });

    it("should write the grams in grams for a person in pounds", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBodyStep();
      await user.press(screen.getByRole("radio", { name: "lb, ft, in" }));
      await user.type(screen.getByLabelText("Height, feet"), "5");
      await user.type(screen.getByLabelText("Height, inches"), "11");
      await user.type(screen.getByLabelText("Weight in pounds"), "176.4");
      await user.press(continueButton());
      await user.press(radio(/^Lightly active/));
      await user.press(continueButton());
      await user.press(radio(/^Maintain weight/));
      await user.press(continueButton());

      for (const grams of ["128 g", "160 g", "176 g"]) {
        expect(screen.getByText(grams)).toBeOnTheScreen();
      }
      expect(screen.queryByText(/lb/)).not.toBeOnTheScreen();
    });

    it("should keep a preset that is chosen when going Back and on again", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToProteinStep();
      await user.press(radio(/^Very high/));

      await user.press(backButton());
      await user.press(continueButton());

      expect(radio(/^Very high/)).toBeChecked();
    });

    it("should go Back to the rate when the goal is lose", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToProteinStep();

      await user.press(backButton());

      expect(screen.getByText("Step 6 of 8")).toBeOnTheScreen();
    });
  });

  describe("step 8, diet style", () => {
    it("should be titled Macros, say Step 8 of 8 and ask How do you like to eat?", async () => {
      await renderWizard("first-run");

      await goToDietStep();

      expect(screen.getByRole("heading", { name: "Macros" })).toBeOnTheScreen();
      expect(screen.getByText("Step 8 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 8 of 8" })).toHaveProp(
        "aria-valuenow",
        89,
      );
      expect(screen.getByRole("heading", { name: "How do you like to eat?" })).toBeOnTheScreen();
      expect(
        screen.getByText(
          "This splits the calories left after protein between fat and carbohydrate.",
        ),
      ).toBeOnTheScreen();
    });

    it("should offer three styles with Balanced chosen on arrival, no keto and Continue live", async () => {
      await renderWizard("first-run");

      await goToDietStep();

      expect(screen.getByLabelText("How do you like to eat?")).toHaveProp("role", "radiogroup");
      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(radio(/^Balanced/)).toBeChecked();
      expect(screen.queryByRole("radio", { name: /^Keto/i })).not.toBeOnTheScreen();
      expect(continueButton()).toBeEnabled();
    });

    it("should lead on to the estimate, with its header, its card and Start in place of Continue", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToDietStep();
      await user.press(radio(/^Low carb/));

      await user.press(continueButton());

      expect(screen.getByRole("heading", { name: "Your estimate" })).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Setup complete" })).toHaveProp(
        "aria-valuenow",
        100,
      );
      expect(screen.queryByText(/^Step /)).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("heading", { name: "How do you like to eat?" }),
      ).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Your starting targets" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Start" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Close" })).not.toBeOnTheScreen();
    });

    it("should show the estimate of the answers given, with the canvas person's figures", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToDietStep();
      await user.press(continueButton());

      const card = await screen.findByLabelText("Calorie target, estimate");

      expect(await within(card).findByText("1,970")).toBeOnTheScreen();
      expect(
        within(card).getByText("To lose about 0.4 kg a week (0.5% of your weight)."),
      ).toBeOnTheScreen();
      expect(within(card).getByLabelText("Protein, 128 g")).toBeOnTheScreen();
      expect(within(card).getByLabelText("Carbs, 218 g")).toBeOnTheScreen();
      expect(within(card).getByLabelText("Fat, 65 g")).toBeOnTheScreen();
      expect(screen.getByText("2,413")).toBeOnTheScreen();
    });

    it("should go back from the estimate to the diet step with the answer kept", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToDietStep();
      await user.press(radio(/^Low carb/));
      await user.press(continueButton());

      await user.press(backButton());

      expect(screen.getByText("Step 8 of 8")).toBeOnTheScreen();
      expect(radio(/^Low carb/)).toBeChecked();
    });

    it("should work out the estimate on today's date in the profile's time zone", async () => {
      // 12:00 UTC is 02:00 on the 24th at UTC+14, the person's 35th birthday, and 34 on the 23rd in UTC.
      setupBackend.timeZone = "Pacific/Kiritimati";
      await renderWizard("first-run");

      await goToEstimate(["24", "10", "1991"]);

      expect(await screen.findByText("2,413")).toBeOnTheScreen();
    });

    it("should work out the estimate on the device's date when the profile has no time zone", async () => {
      await renderWizard("first-run");

      await goToEstimate(["24", "10", "1991"]);

      expect(await screen.findByText("2,420")).toBeOnTheScreen();
    });

    it("should say it is offline and dim Start when the connection is lost on the estimate", async () => {
      await renderWizard("first-run");
      await goToEstimate(["14", "03", "1991"]);
      await screen.findByLabelText("Calorie target, estimate");

      try {
        await act(() => {
          onlineManager.setOnline(false);
        });

        expect(screen.getByText("You're offline")).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
      } finally {
        await act(() => {
          onlineManager.setOnline(true);
        });
      }
    });

    it("should write nothing about the answers to the console, from the activity to the estimate", async () => {
      const consoleCalls = [
        jest.spyOn(console, "log"),
        jest.spyOn(console, "info"),
        jest.spyOn(console, "warn"),
        jest.spyOn(console, "error"),
      ];
      const user = userEvent.setup();
      await renderWizard("first-run");

      await goToDietStep();
      await user.press(continueButton());

      expect(consoleCalls.flatMap((spy) => spy.mock.calls)).toEqual([]);
      expect(setupBackend.writes).toEqual([]);
    });
  });

  describe("recalculating, opened from Targets", () => {
    beforeEach(() => {
      setupBackend.profile = savedProfile;
      setupBackend.program = savedProgram;
    });

    it("should open step 1 with the saved sex chosen and Continue live", async () => {
      await renderWizard("recalculate");

      expect(await screen.findByRole("radio", { name: "Male", checked: true })).toBeOnTheScreen();
      expect(continueButton()).toBeEnabled();
    });

    it("should have no Back and a Close on the right of step 1", async () => {
      await renderWizard("recalculate");

      expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
      expect(closeButton()).toBeOnTheScreen();
    });

    it("should carry the saved birth date to step 2, ready to continue", async () => {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });

      await user.press(continueButton());

      expect(screen.getByLabelText("Day of birth")).toHaveDisplayValue("14");
      expect(screen.getByText("You are 35.")).toBeOnTheScreen();
      expect(continueButton()).toBeEnabled();
    });

    it("should have Close on every step", async () => {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });

      await user.press(continueButton());
      expect(closeButton()).toBeOnTheScreen();
      expect(backButton()).toBeOnTheScreen();

      await user.press(continueButton());
      expect(screen.getByText("Step 3 of 8")).toBeOnTheScreen();
      expect(closeButton()).toBeOnTheScreen();
    });

    it("should return to Targets with Close, from any step", async () => {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      await user.press(continueButton());

      await user.press(closeButton());

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to Targets, and not back, when it was opened with nothing before it", async () => {
      const user = userEvent.setup();
      routerMock.canGoBack.mockReturnValue(false);
      await renderWizard("recalculate");

      await user.press(closeButton());

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/targets");
    });

    it("should read Step 1 of 7 when the saved goal is maintain", async () => {
      setupBackend.program = { ...savedProgram, goal: "maintain", rate_pct_per_week: 0 };
      await renderWizard("recalculate");

      expect(await screen.findByText("Step 1 of 7")).toBeOnTheScreen();
    });

    it("should read Step 2 of 8 for a saved Lose goal and Step 2 of 7 once a new birth date under 18 resets it", async () => {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      await user.press(continueButton());
      expect(screen.getByText("Step 2 of 8")).toBeOnTheScreen();

      await user.clear(screen.getByLabelText("Year of birth"));
      await user.type(screen.getByLabelText("Year of birth"), "2010");

      expect(screen.getByText("Step 2 of 7")).toBeOnTheScreen();
    });

    it("should keep Step 2 of 8 for a new birth date that is still 18 or over", async () => {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      await user.press(continueButton());

      await user.clear(screen.getByLabelText("Year of birth"));
      await user.type(screen.getByLabelText("Year of birth"), "1995");

      expect(screen.getByText("Step 2 of 8")).toBeOnTheScreen();
    });
  });

  describe("recalculating, the steps after the height and weight", () => {
    beforeEach(() => {
      setupBackend.profile = savedProfile;
      setupBackend.program = savedProgram;
      setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-21" };
    });

    it("should open the activity with the saved level chosen", async () => {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      await user.press(continueButton());
      await user.press(continueButton());
      await user.press(continueButton());

      expect(screen.getByText("Step 4 of 8")).toBeOnTheScreen();
      expect(radio(/^Lightly active/)).toBeChecked();
      expect(continueButton()).toBeEnabled();
    });

    it("should open the goal with the saved goal chosen, and the rate with the saved rate", async () => {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      for (let step = 0; step < 4; step += 1) {
        await user.press(continueButton());
      }

      expect(screen.getByText("Step 5 of 8")).toBeOnTheScreen();
      expect(radio(/^Lose weight/)).toBeChecked();
      await user.press(continueButton());

      expect(radio(/^0\.5% a week, Suggested/)).toBeChecked();
    });

    it("should snap a saved rate that is not a preset to the nearest one before the rate shows", async () => {
      const user = userEvent.setup();
      setupBackend.program = { ...savedProgram, rate_pct_per_week: 0.6 };
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      for (let step = 0; step < 5; step += 1) {
        await user.press(continueButton());
      }

      expect(screen.getByText("Step 6 of 8")).toBeOnTheScreen();
      expect(radio(/^0\.5% a week, Suggested/)).toBeChecked();
    });

    it("should snap a saved gain rate of 0.4 to 0.5", async () => {
      const user = userEvent.setup();
      setupBackend.program = { ...savedProgram, goal: "gain", rate_pct_per_week: 0.4 };
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      for (let step = 0; step < 5; step += 1) {
        await user.press(continueButton());
      }

      expect(radio(/^0\.5% a week/)).toBeChecked();
    });

    it("should lead on to the estimate of the saved answers, with Close and Save targets", async () => {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      for (let step = 0; step < 8; step += 1) {
        await user.press(continueButton());
      }

      const card = await screen.findByLabelText("Calorie target, estimate");

      expect(await within(card).findByText("1,970")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save targets" })).toBeOnTheScreen();
      expect(closeButton()).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Start" })).not.toBeOnTheScreen();
    });

    it("should open the protein and the diet with the saved ones chosen", async () => {
      const user = userEvent.setup();
      setupBackend.program = {
        ...savedProgram,
        protein_g_per_kg: 2.2,
        split_preset: "low_carb",
      };
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      for (let step = 0; step < 6; step += 1) {
        await user.press(continueButton());
      }
      expect(radio(/^Very high/)).toBeChecked();
      await user.press(continueButton());

      expect(radio(/^Low carb/)).toBeChecked();
    });

    it("should choose the defaults on arrival for a saved protein and diet that are not on offer", async () => {
      const user = userEvent.setup();
      setupBackend.program = {
        ...savedProgram,
        protein_g_per_kg: 1.8,
        split_preset: "keto",
      };
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      for (let step = 0; step < 6; step += 1) {
        await user.press(continueButton());
      }
      expect(radio(/^Moderate/)).toBeChecked();
      await user.press(continueButton());

      expect(radio(/^Balanced/)).toBeChecked();
    });

    it("should leave the rate step out of the count and the way through for a saved maintain goal", async () => {
      const user = userEvent.setup();
      setupBackend.program = { ...savedProgram, goal: "maintain", rate_pct_per_week: 0 };
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      for (let step = 0; step < 4; step += 1) {
        await user.press(continueButton());
      }
      expect(screen.getByText("Step 5 of 7")).toBeOnTheScreen();

      await user.press(continueButton());

      expect(screen.getByText("Step 6 of 7")).toBeOnTheScreen();
      expect(radio(/^Moderate/)).toBeChecked();
    });
  });

  describe("saving from the estimate", () => {
    // The recalculation's estimate of the saved answers, which every step has prefilled.
    async function goToRecalculatedEstimate() {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      for (let step = 0; step < 8; step += 1) {
        await user.press(continueButton());
      }
      await screen.findByLabelText("Calorie target, estimate");
    }

    // Holds every write until the test lets go, so the screen can be looked at while the save is under way.
    function holdWrites(): () => Promise<void> {
      let release: () => void = () => undefined;
      setupBackend.writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      return () =>
        act(() => {
          release();
        });
    }

    const toastedTargetsSaved = () => screen.queryByText("Targets saved");

    describe("on the first run", () => {
      async function goToFirstRunEstimate() {
        await renderWizard("first-run");
        await goToEstimate(["14", "03", "1991"]);
        await screen.findByLabelText("Calorie target, estimate");
      }

      it("should save once when Start is pressed: the weigh-in, the program, then the profile", async () => {
        const user = userEvent.setup();
        await goToFirstRunEstimate();

        await user.press(screen.getByRole("button", { name: "Start" }));

        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledTimes(1);
        });
        expect(setupBackend.writes).toEqual(["POST weigh_ins", "POST programs", "PATCH profiles"]);
      });

      it("should save the estimate's targets and the weight from the body step, dated in the device's time zone", async () => {
        const user = userEvent.setup();
        await goToFirstRunEstimate();

        await user.press(screen.getByRole("button", { name: "Start" }));

        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledTimes(1);
        });
        expect(setupBackend.writeBodies["PATCH profiles"]).toMatchObject({
          target_kcal: 1970,
          onboarding_weight_kg: 80,
        });
        expect(setupBackend.writeBodies["POST weigh_ins"]).toMatchObject({
          weight_kg: 80,
          tz: "UTC",
        });
      });

      it("should date the weigh-in in the profile's time zone when it has one", async () => {
        const user = userEvent.setup();
        setupBackend.timeZone = "Europe/London";
        await goToFirstRunEstimate();

        await user.press(screen.getByRole("button", { name: "Start" }));

        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledTimes(1);
        });
        expect(setupBackend.writeBodies["POST weigh_ins"]).toMatchObject({ tz: "Europe/London" });
      });

      it("should replace the wizard with the Diary on today, with no toast and no going back", async () => {
        const user = userEvent.setup();
        await goToFirstRunEstimate();

        await user.press(screen.getByRole("button", { name: "Start" }));

        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledTimes(1);
        });
        expect(routerMock.replace).toHaveBeenCalledWith("/diary?day=2026-10-23");
        expect(routerMock.back).not.toHaveBeenCalled();
        expect(screen.queryByRole("status")).not.toBeOnTheScreen();
      });

      it("should not leave the wizard until the save is done", async () => {
        const user = userEvent.setup();
        await goToFirstRunEstimate();
        const release = holdWrites();

        await user.press(screen.getByRole("button", { name: "Start" }));

        expect(routerMock.replace).not.toHaveBeenCalled();
        await release();
        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledTimes(1);
        });
      });

      it("should mark Start busy and dim Back while the save is under way, and save once for a second press", async () => {
        const user = userEvent.setup();
        await goToFirstRunEstimate();
        const release = holdWrites();
        await user.press(screen.getByRole("button", { name: "Start" }));

        const saving = await screen.findByRole("button", { busy: true });
        await user.press(saving);

        expect(backButton()).toBeDisabled();
        expect(setupBackend.writes).toEqual(["POST weigh_ins"]);
        await release();
        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledTimes(1);
        });
        expect(setupBackend.writes).toEqual(["POST weigh_ins", "POST programs", "PATCH profiles"]);
      });

      it("should save once when Start is pressed twice before the screen has drawn the first press", async () => {
        await goToFirstRunEstimate();

        await pressTwiceInTheSameMoment(screen.getByRole("button", { name: "Start" }));

        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledTimes(1);
        });
        expect(setupBackend.writes).toEqual(["POST weigh_ins", "POST programs", "PATCH profiles"]);
      });

      it("should do nothing on the Android back button while the save is under way, and step back once it is not", async () => {
        const user = userEvent.setup();
        await goToFirstRunEstimate();
        const release = holdWrites();
        await user.press(screen.getByRole("button", { name: "Start" }));
        await screen.findByRole("button", { busy: true });

        const wasHandledWhileSaving = await pressAndroidBackButton();

        expect(wasHandledWhileSaving).toBe(true);
        expect(screen.getByRole("heading", { name: "Your estimate" })).toBeOnTheScreen();
        expect(routerMock.back).not.toHaveBeenCalled();
        await release();
        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledTimes(1);
        });
      });

      it("should step back from the estimate on the Android back button when nothing is being saved", async () => {
        await goToFirstRunEstimate();

        const wasHandled = await pressAndroidBackButton();

        expect(wasHandled).toBe(true);
        expect(screen.getByText("Step 8 of 8")).toBeOnTheScreen();
      });

      it("should keep Start busy and Back dimmed once the save is done, until the screen has gone", async () => {
        const user = userEvent.setup();
        await goToFirstRunEstimate();

        await user.press(screen.getByRole("button", { name: "Start" }));
        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledTimes(1);
        });

        expect(screen.getByRole("button", { busy: true })).toBeOnTheScreen();
        expect(backButton()).toBeDisabled();
        expect(await pressAndroidBackButton()).toBe(true);
        expect(screen.getByRole("heading", { name: "Your estimate" })).toBeOnTheScreen();
      });

      it("should not leave the wizard when the screen has gone before the save is done", async () => {
        const user = userEvent.setup();
        await goToFirstRunEstimate();
        const release = holdWrites();
        await user.press(screen.getByRole("button", { name: "Start" }));
        await screen.findByRole("button", { busy: true });

        await screen.unmount();
        await release();
        await waitFor(() => {
          expect(setupBackend.writes).toEqual([
            "POST weigh_ins",
            "POST programs",
            "PATCH profiles",
          ]);
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(routerMock.replace).not.toHaveBeenCalled();
      });
    });

    describe("when the save fails", () => {
      async function failTheFirstSave() {
        const user = userEvent.setup();
        await renderWizard("first-run");
        await goToEstimate(["14", "03", "1991"]);
        await screen.findByLabelText("Calorie target, estimate");
        setupBackend.writesFail = true;
        await user.press(screen.getByRole("button", { name: "Start" }));
        await screen.findByText("Not saved. Check your connection and try again.");
        return user;
      }

      it("should show the banner above Start, stay on the estimate and not leave", async () => {
        await failTheFirstSave();

        expect(
          screen.getByText("Not saved. Check your connection and try again."),
        ).toBeOnTheScreen();
        expect(screen.getByRole("heading", { name: "Your estimate" })).toBeOnTheScreen();
        expect(routerMock.replace).not.toHaveBeenCalled();
        expect(routerMock.back).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
      });

      it("should keep the estimate and the answers behind it", async () => {
        const user = await failTheFirstSave();

        expect(await screen.findByText("1,970")).toBeOnTheScreen();
        await user.press(backButton());
        await user.press(backButton());
        expect(radio(/^Moderate/)).toBeChecked();
      });

      it("should save again on the next press, and go on once that works", async () => {
        const user = await failTheFirstSave();
        setupBackend.writesFail = false;
        setupBackend.writes = [];

        await user.press(screen.getByRole("button", { name: "Start" }));

        await waitFor(() => {
          expect(routerMock.replace).toHaveBeenCalledWith("/diary?day=2026-10-23");
        });
        expect(setupBackend.writes).toContain("PATCH profiles");
        expect(
          screen.queryByText("Not saved. Check your connection and try again."),
        ).not.toBeOnTheScreen();
      });

      it("should take the banner down while the retry is under way", async () => {
        const user = await failTheFirstSave();
        setupBackend.writesFail = false;
        const release = holdWrites();

        await user.press(screen.getByRole("button", { name: "Start" }));

        await screen.findByRole("button", { busy: true });
        expect(
          screen.queryByText("Not saved. Check your connection and try again."),
        ).not.toBeOnTheScreen();
        await release();
      });

      it("should show no raw error text and write nothing to the console", async () => {
        const consoleCalls = [
          jest.spyOn(console, "log"),
          jest.spyOn(console, "info"),
          jest.spyOn(console, "warn"),
          jest.spyOn(console, "error"),
        ];

        await failTheFirstSave();

        expect(screen.queryByText(/XX000|unavailable|Could not save/)).not.toBeOnTheScreen();
        expect(consoleCalls.flatMap((spy) => spy.mock.calls)).toEqual([]);
      });
    });

    describe("when the connection is lost", () => {
      it("should save nothing when the dimmed Start is pressed", async () => {
        const user = userEvent.setup();
        await renderWizard("first-run");
        await goToEstimate(["14", "03", "1991"]);
        await screen.findByLabelText("Calorie target, estimate");

        try {
          await act(() => {
            onlineManager.setOnline(false);
          });
          await user.press(screen.getByRole("button", { name: "Start" }));

          expect(setupBackend.writes).toEqual([]);
          expect(routerMock.replace).not.toHaveBeenCalled();
        } finally {
          await act(() => {
            onlineManager.setOnline(true);
          });
        }
      });
    });

    describe("when recalculating", () => {
      beforeEach(() => {
        setupBackend.profile = savedProfile;
        setupBackend.program = savedProgram;
        // The same weight as the saved answers show, so the repo has no new weigh-in to write.
        setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-22" };
      });

      it("should save with Save targets, once, and leave the weigh-in the repo skips alone", async () => {
        const user = userEvent.setup();
        await goToRecalculatedEstimate();

        await user.press(screen.getByRole("button", { name: "Save targets" }));

        await waitFor(() => {
          expect(routerMock.back).toHaveBeenCalledTimes(1);
        });
        expect(setupBackend.writes).toEqual(["PATCH programs", "PATCH profiles"]);
      });

      it("should go back to Targets and say Targets saved, without replacing the wizard", async () => {
        const user = userEvent.setup();
        await goToRecalculatedEstimate();

        await user.press(screen.getByRole("button", { name: "Save targets" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Targets saved");
        expect(routerMock.back).toHaveBeenCalledTimes(1);
        expect(routerMock.replace).not.toHaveBeenCalled();
      });

      it("should go to Targets itself when nothing is before the wizard, and say Targets saved", async () => {
        const user = userEvent.setup();
        routerMock.canGoBack.mockReturnValue(false);
        await goToRecalculatedEstimate();

        await user.press(screen.getByRole("button", { name: "Save targets" }));

        expect(await screen.findByRole("status")).toHaveTextContent("Targets saved");
        expect(routerMock.replace).toHaveBeenCalledWith("/targets");
        expect(routerMock.back).not.toHaveBeenCalled();
      });

      it("should neither leave nor say Targets saved when the save fails", async () => {
        const user = userEvent.setup();
        await goToRecalculatedEstimate();
        setupBackend.writesFail = true;

        await user.press(screen.getByRole("button", { name: "Save targets" }));

        expect(
          await screen.findByText("Not saved. Check your connection and try again."),
        ).toBeOnTheScreen();
        expect(routerMock.back).not.toHaveBeenCalled();
        expect(routerMock.replace).not.toHaveBeenCalled();
        expect(toastedTargetsSaved()).not.toBeOnTheScreen();
      });

      it("should do nothing on the Android back button or on Close while the save is under way", async () => {
        const user = userEvent.setup();
        await goToRecalculatedEstimate();
        const release = holdWrites();
        await user.press(screen.getByRole("button", { name: "Save targets" }));
        await screen.findByRole("button", { busy: true });

        const wasHandled = await pressAndroidBackButton();
        await user.press(closeButton());

        expect(wasHandled).toBe(true);
        expect(routerMock.back).not.toHaveBeenCalled();
        expect(screen.getByRole("heading", { name: "Your estimate" })).toBeOnTheScreen();
        await release();
        await waitFor(() => {
          expect(routerMock.back).toHaveBeenCalledTimes(1);
        });
      });

      it("should keep Close, Back and Save targets inert once the save is done, so it leaves once", async () => {
        const user = userEvent.setup();
        await goToRecalculatedEstimate();
        await user.press(screen.getByRole("button", { name: "Save targets" }));
        await waitFor(() => {
          expect(routerMock.back).toHaveBeenCalledTimes(1);
        });

        await user.press(closeButton());
        await user.press(backButton());
        const wasHandled = await pressAndroidBackButton();

        expect(wasHandled).toBe(true);
        expect(screen.getByRole("button", { busy: true })).toBeOnTheScreen();
        expect(closeButton()).toBeDisabled();
        expect(routerMock.back).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("heading", { name: "Your estimate" })).toBeOnTheScreen();
      });

      it("should neither say Targets saved nor leave when the screen has gone before the save is done", async () => {
        const user = userEvent.setup();
        await goToRecalculatedEstimate();
        const release = holdWrites();
        await user.press(screen.getByRole("button", { name: "Save targets" }));
        await screen.findByRole("button", { busy: true });

        await screen.unmount();
        await release();
        await waitFor(() => {
          expect(setupBackend.writes).toEqual(["PATCH programs", "PATCH profiles"]);
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(routerMock.back).not.toHaveBeenCalled();
        expect(routerMock.replace).not.toHaveBeenCalled();
        expect(toastedTargetsSaved()).not.toBeOnTheScreen();
      });
    });
  });

  describe("recalculating once the engine has run", () => {
    // The golden person's weigh-ins end on 22 October, so the trend weight on yesterday is 79.0227 kg.
    const goldenWeighIns = goldenCheckinFixture("2026-09-25").weighIns;
    const latestGoldenWeighIn = goldenWeighIns.at(-1);

    beforeEach(() => {
      setupBackend.profile = savedProfile;
      setupBackend.program = savedProgram;
      setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-22" };
    });

    function haveGoldenWeighIns() {
      setupBackend.weighInHistory = weighInHistoryRows(goldenWeighIns);
      setupBackend.weighIn = {
        weight_kg: latestGoldenWeighIn?.weightKg ?? 0,
        local_date: latestGoldenWeighIn?.localDate ?? "",
      };
    }

    function haveHadThreeMeasuredCheckins() {
      haveGoldenWeighIns();
      setupBackend.snapshots = [
        startSnapshotRow("2026-09-25", 2500),
        measuredSnapshotRow("2026-10-09", 2559.56),
        measuredSnapshotRow("2026-10-16", 2574.22),
        measuredSnapshotRow("2026-10-23", 2579.54),
      ];
    }

    // Through the saved answers to the estimate, changing the rate on the way when one is given.
    async function goToEstimateAtRate(rate?: RegExp) {
      const user = userEvent.setup();
      await renderWizard("recalculate");
      await screen.findByRole("radio", { name: "Male", checked: true });
      for (let step = 0; step < 5; step += 1) {
        await user.press(continueButton());
      }
      if (rate !== undefined) {
        await user.press(radio(rate));
      }
      for (let step = 0; step < 3; step += 1) {
        await user.press(continueButton());
      }
      await screen.findByLabelText("Calorie target, estimate");
    }

    const checkinAccuracyLine =
      "This is a starting estimate from your answers. Each week, Ki-Lo checks it against your weigh-ins and food log and adjusts your targets.";

    describe("while the person is settling", () => {
      beforeEach(() => {
        setupBackend.snapshots = [startSnapshotRow("2026-10-20", 2413.125)];
      });

      it("should draw the starting estimate of the answers, with only the accuracy line changed", async () => {
        await goToEstimateAtRate();

        expect(
          await within(screen.getByLabelText("Calorie target, estimate")).findByText("1,970"),
        ).toBeOnTheScreen();
        expect(screen.getByRole("heading", { name: "Your starting targets" })).toBeOnTheScreen();
        expect(screen.getByText("The energy you use in a day")).toBeOnTheScreen();
        expect(screen.getByText("2,413")).toBeOnTheScreen();
        expect(screen.getByText(checkinAccuracyLine)).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Save targets" })).toBeEnabled();
      });

      it("should draw the same when the account has no snapshot at all", async () => {
        setupBackend.snapshots = [];

        await goToEstimateAtRate();

        expect(
          await within(screen.getByLabelText("Calorie target, estimate")).findByText("1,970"),
        ).toBeOnTheScreen();
        expect(screen.getByRole("heading", { name: "Your starting targets" })).toBeOnTheScreen();
      });
    });

    describe("after a check-in that measured", () => {
      beforeEach(haveHadThreeMeasuredCheckins);

      it("should keep the measured expenditure and show the targets of 0.25% a week: 2,360 kcal, P 126, F 82, C 280", async () => {
        await goToEstimateAtRate(/^0\.25% a week/);

        const card = screen.getByLabelText("Calorie target, estimate");
        expect(await within(card).findByText("2,360")).toBeOnTheScreen();
        expect(within(card).getByLabelText("Protein, 126 g")).toBeOnTheScreen();
        expect(within(card).getByLabelText("Carbs, 280 g")).toBeOnTheScreen();
        expect(within(card).getByLabelText("Fat, 82 g")).toBeOnTheScreen();
        expect(
          screen.getByText("To lose about 0.2 kg a week (0.25% of your weight)."),
        ).toBeOnTheScreen();
        expect(screen.getByText("2,580")).toBeOnTheScreen();
      });

      it("should say the expenditure was measured, and when", async () => {
        await goToEstimateAtRate(/^0\.25% a week/);

        expect(await screen.findByRole("heading", { name: "Your new targets" })).toBeOnTheScreen();
        expect(screen.getByText("Measured from your weigh-ins and food log")).toBeOnTheScreen();
        expect(
          screen.getByText(
            "Ki-Lo measured your expenditure at your last check-in, on Friday 23 October. Changing your answers keeps it and changes only your targets.",
          ),
        ).toBeOnTheScreen();
        expect(screen.queryByText(checkinAccuracyLine)).toBeNull();
        expect(screen.getByRole("button", { name: "Save targets" })).toBeEnabled();
        expect(closeButton()).toBeOnTheScreen();
      });

      it("should keep the saved rate's targets from the same measured expenditure when the rate is not changed", async () => {
        await goToEstimateAtRate();

        // 2,579.54 - 0.005 x 79.0227 x 1,100 = 2,144.9, so 2,140 kcal: the day 28 golden targets.
        expect(
          await within(screen.getByLabelText("Calorie target, estimate")).findByText("2,140"),
        ).toBeOnTheScreen();
      });

      it("should date the measurement by the newest check-in that measured, when a later one did not", async () => {
        setupBackend.snapshots = [
          startSnapshotRow("2026-09-25", 2500),
          measuredSnapshotRow("2026-10-09", 2559.56),
          measuredSnapshotRow("2026-10-16", 2574.22),
          unmeasuredSnapshotRow("2026-10-23", 2574.22),
        ];

        await goToEstimateAtRate();

        expect(
          await screen.findByText(
            "Ki-Lo measured your expenditure at your last check-in, on Friday 16 October. Changing your answers keeps it and changes only your targets.",
          ),
        ).toBeOnTheScreen();
      });

      it("should say what the trend weight, not the weight entered, gives for a week at the rate", async () => {
        // The weight entered is 60 kg and the trend weight is 79.0227 kg: 0.5% of 79.0227 is 0.4 kg and of 60 is 0.3.
        setupBackend.weighIn = { weight_kg: 60, local_date: "2026-10-22" };

        await goToEstimateAtRate();

        expect(
          await screen.findByText("To lose about 0.4 kg a week (0.5% of your weight)."),
        ).toBeOnTheScreen();
      });

      it("should read the expenditure history from 52 weeks back, so the newest measurement is found whenever it was made", async () => {
        await goToEstimateAtRate();
        await screen.findByRole("heading", { name: "Your new targets" });

        // 23 October 2026 less 52 weeks.
        expect(setupBackend.snapshotFromDates).toEqual(["2025-10-24"]);
      });

      it("should date the measurement by a check-in 8 weeks back, when two later ones did not measure", async () => {
        setupBackend.snapshots = [
          startSnapshotRow("2026-08-14", 2500),
          measuredSnapshotRow("2026-08-28", 2559.56),
          unmeasuredSnapshotRow("2026-10-09", 2559.56),
          unmeasuredSnapshotRow("2026-10-16", 2559.56),
        ];

        await goToEstimateAtRate();

        expect(
          await screen.findByText(
            "Ki-Lo measured your expenditure at your last check-in, on Friday 28 August. Changing your answers keeps it and changes only your targets.",
          ),
        ).toBeOnTheScreen();
        expect(screen.queryByText(/has not measured your expenditure yet/)).toBeNull();
      });

      it("should use the latest weigh-in's weight when the only weigh-in is today's, not the weight entered", async () => {
        const user = userEvent.setup();
        setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-23" };
        setupBackend.weighInHistory = weighInHistoryRows([
          { localDate: "2026-10-23", weightKg: 80 },
        ]);
        await renderWizard("recalculate");
        await screen.findByRole("radio", { name: "Male", checked: true });
        await user.press(continueButton());
        await user.press(continueButton());
        await user.clear(screen.getByLabelText("Weight in kilograms"));
        await user.type(screen.getByLabelText("Weight in kilograms"), "60");
        for (let step = 0; step < 6; step += 1) {
          await user.press(continueButton());
        }
        await screen.findByLabelText("Calorie target, estimate");

        // No trend point is on or before yesterday. 2,579.54 - 0.005 x 80 x 1,100 = 2,139.5, so 2,140 kcal and
        // 0.4 kg a week at 80 kg. The 60 kg entered would give 2,250 kcal and 0.3 kg.
        expect(
          await within(screen.getByLabelText("Calorie target, estimate")).findByText("2,140"),
        ).toBeOnTheScreen();
        expect(
          screen.getByText("To lose about 0.4 kg a week (0.5% of your weight)."),
        ).toBeOnTheScreen();
      });

      it("should save as it always did, and leave the recompute to make the targets", async () => {
        const user = userEvent.setup();
        await goToEstimateAtRate(/^0\.25% a week/);
        await screen.findByRole("heading", { name: "Your new targets" });

        await user.press(screen.getByRole("button", { name: "Save targets" }));

        await waitFor(() => {
          expect(routerMock.back).toHaveBeenCalledTimes(1);
        });
        expect(setupBackend.writes).toEqual(["PATCH programs", "PATCH profiles"]);
      });
    });

    describe("whichever programme the newest snapshot belongs to", () => {
      beforeEach(() => {
        haveGoldenWeighIns();
      });

      it("should keep the measured expenditure of a programme that has ended, when it is 10 days old", async () => {
        setupBackend.snapshots = [
          { ...measuredSnapshotRow("2026-10-13", 2579.54), program_id: "ended-programme" },
        ];

        await goToEstimateAtRate();

        // The server's recompute keeps the newest snapshot of any programme: 2,579.54 gives 2,140 at 0.5%.
        expect(
          await within(screen.getByLabelText("Calorie target, estimate")).findByText("2,140"),
        ).toBeOnTheScreen();
        expect(
          screen.getByText(
            "Ki-Lo measured your expenditure at your last check-in, on Tuesday 13 October. Changing your answers keeps it and changes only your targets.",
          ),
        ).toBeOnTheScreen();
      });

      it("should start again from the answers when the newest check-in is 35 days old", async () => {
        setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-22" };
        setupBackend.snapshots = [measuredSnapshotRow("2026-09-18", 2579.54)];

        await goToEstimateAtRate();

        // The recompute makes a new start snapshot from the answers, so the estimate of the answers is drawn.
        expect(
          await within(screen.getByLabelText("Calorie target, estimate")).findByText("1,970"),
        ).toBeOnTheScreen();
        expect(screen.getByRole("heading", { name: "Your starting targets" })).toBeOnTheScreen();
      });
    });

    describe("after check-ins that never measured", () => {
      beforeEach(() => {
        haveGoldenWeighIns();
        setupBackend.snapshots = [
          startSnapshotRow("2026-10-09", 2500),
          unmeasuredSnapshotRow("2026-10-23", 2500),
        ];
      });

      it("should say the expenditure is carried forward, and show the targets worked out from it", async () => {
        await goToEstimateAtRate();

        // 2,500 - 0.005 x 79.0227 x 1,100 = 2,065.4, so 2,070 kcal.
        expect(
          await within(screen.getByLabelText("Calorie target, estimate")).findByText("2,070"),
        ).toBeOnTheScreen();
        expect(screen.getByRole("heading", { name: "Your new targets" })).toBeOnTheScreen();
        expect(screen.getByText("Carried forward from your last check-in")).toBeOnTheScreen();
        expect(screen.getByText("2,500")).toBeOnTheScreen();
        expect(
          screen.getByText(
            "Ki-Lo has not measured your expenditure yet, so it keeps the estimate from your last check-in. Changing your answers changes only your targets.",
          ),
        ).toBeOnTheScreen();
      });
    });

    describe("while the reads are not known yet", () => {
      beforeEach(haveHadThreeMeasuredCheckins);

      it("should dim Save targets until the expenditure history has been read, and then draw the measured estimate", async () => {
        let release: () => void = () => undefined;
        setupBackend.snapshotReadGate = new Promise<void>((resolve) => {
          release = resolve;
        });

        await goToEstimateAtRate(/^0\.25% a week/);

        expect(screen.getByRole("button", { name: "Save targets" })).toBeDisabled();
        expect(screen.queryByText("2,580")).toBeNull();

        await act(() => {
          release();
        });

        expect(await screen.findByText("2,580")).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Save targets" })).toBeEnabled();
      });

      it("should dim Save targets until the weigh-ins have been read, and then draw the measured estimate", async () => {
        let release: () => void = () => undefined;
        setupBackend.weighInListReadGate = new Promise<void>((resolve) => {
          release = resolve;
        });

        await goToEstimateAtRate(/^0\.25% a week/);

        expect(screen.getByRole("button", { name: "Save targets" })).toBeDisabled();
        expect(screen.queryByText("2,580")).toBeNull();

        await act(() => {
          release();
        });

        expect(await screen.findByText("2,580")).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Save targets" })).toBeEnabled();
      });

      it("should save nothing when the dimmed Save targets is pressed", async () => {
        const user = userEvent.setup();
        setupBackend.snapshotReadGate = new Promise<void>(() => undefined);
        await goToEstimateAtRate();

        await user.press(screen.getByRole("button", { name: "Save targets" }));

        expect(setupBackend.writes).toEqual([]);
      });
    });

    describe("when a read fails", () => {
      beforeEach(() => {
        haveHadThreeMeasuredCheckins();
        setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-22" };
        setupBackend.snapshotReadsFail = true;
      });

      it("should draw the starting estimate of the answers and keep Save targets live", async () => {
        await goToEstimateAtRate();

        const card = screen.getByLabelText("Calorie target, estimate");
        expect(await within(card).findByText("1,970")).toBeOnTheScreen();
        await waitFor(() => {
          expect(screen.getByRole("button", { name: "Save targets" })).toBeEnabled();
        });
        expect(screen.getByRole("heading", { name: "Your starting targets" })).toBeOnTheScreen();
        expect(screen.getByText(checkinAccuracyLine)).toBeOnTheScreen();
      });
    });

    describe("when the weigh-ins cannot be read", () => {
      it("should draw the starting estimate of the answers and keep Save targets live", async () => {
        haveHadThreeMeasuredCheckins();
        setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-22" };
        setupBackend.weighInListReadsFail = true;

        await goToEstimateAtRate();

        const card = screen.getByLabelText("Calorie target, estimate");
        expect(await within(card).findByText("1,970")).toBeOnTheScreen();
        await waitFor(() => {
          expect(screen.getByRole("button", { name: "Save targets" })).toBeEnabled();
        });
        expect(screen.getByRole("heading", { name: "Your starting targets" })).toBeOnTheScreen();
      });
    });

    describe("on the first run", () => {
      it("should read no expenditure history and no weigh-in list, because a new account has none", async () => {
        setupBackend.profile = freshProfile;
        setupBackend.program = null;
        setupBackend.weighIn = null;
        await renderWizard("first-run");
        await goToEstimate(["14", "03", "1991"]);
        await screen.findByLabelText("Calorie target, estimate");

        expect(setupBackend.requests.map((request) => request.table)).not.toContain(
          "expenditure_snapshots",
        );
        expect(
          setupBackend.requests.filter(
            (request) => request.table === "weigh_ins" && request.select.includes("measured_at"),
          ),
        ).toEqual([]);
        expect(screen.getByText(checkinAccuracyLine)).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
      });
    });
  });

  describe("the Android back button", () => {
    it("should go to the previous step from step 2", async () => {
      await renderWizard("first-run");
      await goToBirthDateStep();

      const wasHandled = await pressAndroidBackButton();

      expect(wasHandled).toBe(true);
      expect(screen.getByText("Step 1 of 8")).toBeOnTheScreen();
      expect(radio("Male")).toBeChecked();
    });

    it("should close like Close on step 1 when recalculating", async () => {
      await renderWizard("recalculate");

      const wasHandled = await pressAndroidBackButton();

      expect(wasHandled).toBe(true);
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should have exactly one handler while the wizard is open, and none once it is gone", async () => {
      await renderWizard("first-run");
      expect(backPressHandlers).toHaveLength(1);

      await screen.unmount();

      expect(backPressHandlers).toHaveLength(0);
    });

    it("should still have exactly one handler after the step changes", async () => {
      await renderWizard("first-run");

      await goToBirthDateStep();

      expect(backPressHandlers).toHaveLength(1);
    });

    it("should have no handler while the wizard is not the focused screen, and one again when it is", async () => {
      await renderWizard("first-run");

      routerMock.isFocused = false;
      await screen.rerender(wizard("first-run"));
      expect(backPressHandlers).toHaveLength(0);

      routerMock.isFocused = true;
      await screen.rerender(wizard("first-run"));
      expect(backPressHandlers).toHaveLength(1);
    });

    it("should do nothing on step 1 of the first run, where the escape is the way out", async () => {
      await renderWizard("first-run");

      const wasHandled = await pressAndroidBackButton();

      expect(wasHandled).toBe(true);
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "What is your sex?" })).toBeOnTheScreen();
    });

    it("should do nothing on step 1 of the first run while the escape is under way", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      const release = holdWritesNow();
      await user.press(screen.getByRole("button", { name: "I'll set my own targets" }));
      await screen.findByRole("button", { busy: true });

      const wasHandled = await pressAndroidBackButton();

      expect(wasHandled).toBe(true);
      expect(routerMock.back).not.toHaveBeenCalled();
      await release();
    });
  });

  describe("what the wizard reads", () => {
    it("should read the profile, the program and the latest weigh-in once the Terms are accepted", async () => {
      await renderWizard("first-run");

      await waitFor(() => {
        expect(setupReads().map((request) => request.table)).toEqual(
          expect.arrayContaining(["profiles", "programs", "weigh_ins"]),
        );
      });
    });

    it("should read nothing while the Terms gate is up", async () => {
      setupBackend.hasAcceptedTerms = false;
      await renderWizard("first-run");
      await waitFor(() => {
        expect(setupBackend.requests.length).toBeGreaterThan(0);
      });

      expect(setupReads()).toEqual([]);
      expect(screen.getByText("Step 1 of 8")).toBeOnTheScreen();
    });

    it("should open with nothing chosen, and say nothing about it, when the saved answers cannot be read", async () => {
      setupBackend.readsFail = true;
      await renderWizard("recalculate");
      await waitFor(() => {
        expect(setupReads().length).toBeGreaterThan(0);
      });

      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(continueButton()).toBeDisabled();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should leave what the person is typing alone when the saved answers arrive after they started", async () => {
      const user = userEvent.setup();
      let release: () => void = () => undefined;
      setupBackend.readGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      setupBackend.profile = savedProfile;
      // A saved Maintain goal makes the count read of 7, which only shows once the saved answers have joined the draft.
      setupBackend.program = { ...savedProgram, goal: "maintain", rate_pct_per_week: 0 };
      await renderWizard("recalculate");
      await user.press(radio("Female"));
      await user.press(continueButton());
      await user.type(screen.getByLabelText("Day of birth"), "31");
      await user.type(screen.getByLabelText("Month of birth"), "0", { skipBlur: true });

      await act(() => {
        release();
      });

      expect(await screen.findByText("Step 2 of 7")).toBeOnTheScreen();
      expect(screen.getByLabelText("Day of birth")).toHaveDisplayValue("31");
      expect(screen.getByLabelText("Month of birth")).toHaveDisplayValue("0");
      expect(screen.getByLabelText("Year of birth")).toHaveDisplayValue("");
      expect(continueButton()).toBeDisabled();
    });

    it("should reset a saved Lose goal when the birth date typed during the load makes the person 16", async () => {
      const user = userEvent.setup();
      let release: () => void = () => undefined;
      setupBackend.readGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      setupBackend.profile = savedProfile;
      setupBackend.program = savedProgram;
      await renderWizard("recalculate");
      await user.press(radio("Female"));
      await user.press(continueButton());
      await typeBirthDate("01", "05", "2010");

      await act(() => {
        release();
      });

      expect(await screen.findByText("Step 2 of 7")).toBeOnTheScreen();
      expect(screen.getByLabelText("Year of birth")).toHaveDisplayValue("2010");
    });

    it("should put the saved birth date in the fields when the saved answers arrive after step 2 opened", async () => {
      const user = userEvent.setup();
      let release: () => void = () => undefined;
      setupBackend.readGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      setupBackend.profile = savedProfile;
      await renderWizard("recalculate");
      await user.press(radio("Female"));
      await user.press(continueButton());

      await act(() => {
        release();
      });

      expect(await screen.findByDisplayValue("1991")).toBeOnTheScreen();
      expect(screen.getByText("You are 35.")).toBeOnTheScreen();
      await user.press(backButton());
      // The answer the person gave before the saved ones arrived is the one that stands.
      expect(radio("Female")).toBeChecked();
    });
  });
});
