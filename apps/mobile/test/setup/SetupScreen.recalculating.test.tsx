import { onlineManager } from "@tanstack/react-query";
import { act, screen, userEvent, waitFor, within } from "@testing-library/react-native";

import { routerMock } from "../support/expoRouterMock";
import { pressTwiceInTheSameMoment } from "../support/sameTickPress";
import { savedProfile, savedProgram, setupBackend } from "../support/setupBackend";
import {
  backButton,
  closeButton,
  continueButton,
  goToEstimate,
  pressAndroidBackButton,
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
        await act(() => jest.advanceTimersByTimeAsync(50));

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
        await act(() => jest.advanceTimersByTimeAsync(50));

        expect(routerMock.back).not.toHaveBeenCalled();
        expect(routerMock.replace).not.toHaveBeenCalled();
        expect(toastedTargetsSaved()).not.toBeOnTheScreen();
      });
    });
  });
});
