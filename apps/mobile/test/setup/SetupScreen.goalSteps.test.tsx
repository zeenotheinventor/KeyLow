import { onlineManager } from "@tanstack/react-query";
import { act, screen, userEvent, within } from "@testing-library/react-native";

import { setupBackend } from "../support/setupBackend";
import {
  backButton,
  continueButton,
  goToActivityStep,
  goToBodyStep,
  goToDietStep,
  goToEstimate,
  goToGoalStep,
  goToProteinStep,
  goToRateStep,
  radio,
  registerWizardHooks,
  renderWizard,
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
});
