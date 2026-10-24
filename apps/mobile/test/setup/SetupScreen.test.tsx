import { KeyLowProvider } from "@keylow/api-client";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { SetupScreen } from "../../components/SetupScreen";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import {
  freshProfile,
  resetSetupBackend,
  savedProfile,
  savedProgram,
  setupBackend,
  setupClient,
  setupReads,
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
      <SetupScreen mode={mode} />
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

// The time zone the device reports, which the screen reads today's date in.
function deviceTimeZone(timeZone: string) {
  jest
    .spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
    .mockImplementation(() => ({ timeZone }) as Intl.ResolvedDateTimeFormatOptions);
}

async function goToBodyStep() {
  const user = userEvent.setup();
  await goToBirthDateStep();
  await typeBirthDate("14", "03", "1991");
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

  beforeEach(() => {
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

    it("should draw only the header and the progress bar for a step that is not built yet", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBodyStep();
      await user.type(screen.getByLabelText("Height in centimetres"), "180");
      await user.type(screen.getByLabelText("Weight in kilograms"), "80");

      await user.press(continueButton());

      expect(screen.getByRole("heading", { name: "Activity" })).toBeOnTheScreen();
      expect(screen.getByText("Step 4 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 4 of 8" })).toHaveProp(
        "aria-valuenow",
        44,
      );
      expect(
        screen.queryByRole("heading", { name: "How tall are you, and what do you weigh?" }),
      ).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeOnTheScreen();

      await user.press(backButton());

      expect(screen.getByText("Step 3 of 8")).toBeOnTheScreen();
      expect(screen.getByLabelText("Height in centimetres")).toHaveDisplayValue("180");
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

    it("should be left to the system on step 1 of the first run", async () => {
      await renderWizard("first-run");

      const wasHandled = await pressAndroidBackButton();

      expect(wasHandled).toBe(false);
      expect(routerMock.back).not.toHaveBeenCalled();
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
