import { act, screen, userEvent, waitFor } from "@testing-library/react-native";

import { routerMock } from "../support/expoRouterMock";
import { pressTwiceInTheSameMoment } from "../support/sameTickPress";
import { freshProfile, savedProfile, savedProgram, setupBackend } from "../support/setupBackend";
import {
  backButton,
  continueButton,
  deviceRegion,
  deviceTimeZone,
  goToBirthDateStep,
  goToBodyStep,
  goToGoalStep,
  holdWritesNow,
  preferNotToSay,
  radio,
  registerWizardHooks,
  renderWizard,
  typeBirthDate,
} from "./support/wizard";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
// The region the device reports, which the wizard's tests set through deviceRegion.
jest.mock("expo-localization", () => ({
  getLocales: () => [
    {
      regionCode:
        jest.requireActual<typeof import("./support/wizard")>("./support/wizard").deviceRegion
          .current,
    },
  ],
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

describe("the setup wizard", () => {
  registerWizardHooks();

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
      await act(() => jest.advanceTimersByTimeAsync(50));

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
        deviceRegion.current = "US";
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
        deviceRegion.current = "US";
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
});
