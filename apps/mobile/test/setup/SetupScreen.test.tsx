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

    it("should draw only the header and the progress bar for a step that is not built yet", async () => {
      const user = userEvent.setup();
      await renderWizard("first-run");
      await goToBirthDateStep();
      await typeBirthDate("14", "03", "1991");

      await user.press(continueButton());

      expect(screen.getByRole("heading", { name: "About you" })).toBeOnTheScreen();
      expect(screen.getByText("Step 3 of 8")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Step 3 of 8" })).toHaveProp(
        "aria-valuenow",
        33,
      );
      expect(screen.queryByRole("heading", { name: "When were you born?" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Continue" })).not.toBeOnTheScreen();

      await user.press(backButton());

      expect(screen.getByText("Step 2 of 8")).toBeOnTheScreen();
      expect(screen.getByText("You are 35.")).toBeOnTheScreen();
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
      await renderWizard("recalculate");
      await user.press(radio("Female"));
      await user.press(continueButton());
      await user.type(screen.getByLabelText("Day of birth"), "31");
      await user.type(screen.getByLabelText("Month of birth"), "0", { skipBlur: true });

      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(queryClient.isFetching()).toBe(0);
      });

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
