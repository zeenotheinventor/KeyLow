import { goldenCheckinFixture } from "@keylow/core/testing";
import { act, screen, userEvent, waitFor, within } from "@testing-library/react-native";

import { routerMock } from "../support/expoRouterMock";
import {
  freshProfile,
  measuredSnapshotRow,
  savedProfile,
  savedProgram,
  setupBackend,
  setupReads,
  startSnapshotRow,
  unmeasuredSnapshotRow,
  weighInHistoryRows,
} from "../support/setupBackend";
import {
  backButton,
  backPressHandlers,
  wizard,
  closeButton,
  continueButton,
  goToBirthDateStep,
  goToEstimate,
  holdWritesNow,
  pressAndroidBackButton,
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
