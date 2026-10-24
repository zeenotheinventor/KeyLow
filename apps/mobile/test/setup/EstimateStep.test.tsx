import { startingPlan } from "@keylow/core/setup";
import { cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { AccessibilityInfo } from "react-native";

import { EstimateStep } from "../../components/SetupScreen/steps/EstimateStep";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { expectAccessibleNamesInOrder } from "../support/namesInOrder";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { EstimateStepProps } from "../../components/SetupScreen/steps/EstimateStep";
import type { SetupAnswers } from "@keylow/core/setup";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

const today = "2026-10-23";

// The canvas's three people, as the program canvas's arithmetic works them out.
const defaultAnswers: SetupAnswers = {
  sex: "male",
  birthDate: "1991-03-14",
  heightCm: 180,
  weightKg: 80,
  weightUnit: "kg",
  heightUnit: "cm",
  activity: "light",
  goal: "lose",
  ratePctPerWeek: 0.5,
  proteinPreset: "moderate",
  dietStyle: "balanced",
};

const floorAnswers: SetupAnswers = {
  ...defaultAnswers,
  sex: "female",
  birthDate: "1996-03-14",
  heightCm: 160,
  weightKg: 55,
  activity: "sedentary",
  ratePctPerWeek: 1,
};

const maxDeficitAnswers: SetupAnswers = {
  ...defaultAnswers,
  birthDate: "1986-03-14",
  heightCm: 175,
  weightKg: 130,
  activity: "moderate",
  ratePctPerWeek: 1,
};

type RenderOptions = Partial<Omit<EstimateStepProps, "answers" | "plan">> & {
  answers?: SetupAnswers;
};

const handlers = { onStart: jest.fn(), onBack: jest.fn(), onClose: jest.fn() };

async function renderEstimate({ answers = defaultAnswers, ...props }: RenderOptions = {}) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <EstimateStep
        answers={answers}
        isOffline={false}
        isSaving={false}
        mode="first-run"
        plan={startingPlan(answers, today, null)}
        saveFailed={false}
        {...handlers}
        {...props}
      />
    </ThemeProvider>,
  );
  // The settled frame: the reduce motion setting is read, so nothing is still counting.
  await screen.findByLabelText("Calorie target, estimate");
}

function reduceMotion(isEnabled: boolean) {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

const startButton = () => screen.getByRole("button", { name: "Start" });
// The slash is the kit's, decoration hidden from a screen reader, so it is found by its id with the hidden elements.
const slashes = () =>
  screen.queryAllByTestId("day-complete-slash", { includeHiddenElements: true });
const card = () => screen.getByLabelText("Calorie target, estimate");

describe("the setup estimate", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/SetupScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    reduceMotion(true);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  describe("the default person", () => {
    it("should show 1,970 kcal a day as the calorie target, labelled as an estimate", async () => {
      await renderEstimate();

      expect(await within(card()).findByText("1,970")).toBeOnTheScreen();
      expect(within(card()).getByText("kcal a day")).toBeOnTheScreen();
      expect(within(card()).getByText("Calorie target")).toBeOnTheScreen();
      expect(within(card()).getByText("Estimate")).toBeOnTheScreen();
    });

    it("should show protein 128 g, carbs 218 g and fat 65 g, with no share", async () => {
      await renderEstimate();

      expect(within(card()).getByLabelText("Protein, 128 g")).toBeOnTheScreen();
      expect(within(card()).getByLabelText("Carbs, 218 g")).toBeOnTheScreen();
      expect(within(card()).getByLabelText("Fat, 65 g")).toBeOnTheScreen();
      expect(within(card()).queryByLabelText(/^Carbohydrate/)).not.toBeOnTheScreen();
    });

    it("should show the expenditure in whole kilocalories", async () => {
      await renderEstimate();

      expect(screen.getByText("Estimated expenditure")).toBeOnTheScreen();
      expect(screen.getByText("The energy you use in a day")).toBeOnTheScreen();
      expect(screen.getByText("2,413")).toBeOnTheScreen();
    });

    it("should say what a week at the chosen rate is worth", async () => {
      await renderEstimate();

      expect(
        within(card()).getByText("To lose about 0.4 kg a week (0.5% of your weight)."),
      ).toBeOnTheScreen();
    });

    it("should write the weekly amount in pounds for a person who entered pounds", async () => {
      await renderEstimate({
        answers: { ...defaultAnswers, weightUnit: "lb", heightUnit: "ft_in" },
      });

      expect(
        within(card()).getByText("To lose about 0.9 lb a week (0.5% of your weight)."),
      ).toBeOnTheScreen();
    });

    it("should draw no guardrail line", async () => {
      await renderEstimate();

      expect(screen.queryByText(/Raised to|Kept to|Capped at|Protein was lowered/)).toBeNull();
    });
  });

  describe("the goals", () => {
    it("should say what a gain is worth a week", async () => {
      await renderEstimate({ answers: { ...defaultAnswers, goal: "gain", ratePctPerWeek: 0.25 } });

      expect(
        within(card()).getByText("To gain about 0.2 kg a week (0.25% of your weight)."),
      ).toBeOnTheScreen();
    });

    it("should say the weight is kept where it is for the maintain goal", async () => {
      await renderEstimate({ answers: { ...defaultAnswers, goal: "maintain", ratePctPerWeek: 0 } });

      expect(within(card()).getByText("To keep your weight about where it is.")).toBeOnTheScreen();
    });
  });

  describe("the floor", () => {
    it("should show 1,200 kcal and the floor line, with no rate line", async () => {
      await renderEstimate({ answers: floorAnswers });

      expect(await within(card()).findByText("1,200")).toBeOnTheScreen();
      expect(
        within(card()).getByText(
          "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. You would lose about 0.3 kg a week (0.47% of your weight), not 1.0%.",
        ),
      ).toBeOnTheScreen();
      expect(within(card()).queryByText(/^To lose about/)).toBeNull();
      expect(screen.queryByText(/30% deficit/)).toBeNull();
    });

    it("should show protein 88 g, carbohydrate 127 g and fat 38 g", async () => {
      await renderEstimate({ answers: floorAnswers });

      expect(within(card()).getByLabelText("Protein, 88 g")).toBeOnTheScreen();
      expect(within(card()).getByLabelText("Carbs, 127 g")).toBeOnTheScreen();
      expect(within(card()).getByLabelText("Fat, 38 g")).toBeOnTheScreen();
    });

    it("should show the estimated expenditure of that person", async () => {
      await renderEstimate({ answers: floorAnswers });

      expect(screen.getByText("1,487")).toBeOnTheScreen();
    });
  });

  describe("the 30% deficit", () => {
    it("should show 2,390 kcal and the deficit line, with no rate line", async () => {
      await renderEstimate({ answers: maxDeficitAnswers });

      expect(await within(card()).findByText("2,390")).toBeOnTheScreen();
      expect(
        within(card()).getByText(
          "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.9 kg a week (0.71% of your weight), not 1.0%.",
        ),
      ).toBeOnTheScreen();
      expect(within(card()).queryByText(/^To lose about/)).toBeNull();
    });
  });

  describe("the other guardrails", () => {
    it("should show protein 208 g, carbohydrate 234 g and fat 69 g under the 30% deficit", async () => {
      await renderEstimate({ answers: maxDeficitAnswers });

      expect(within(card()).getByLabelText("Protein, 208 g")).toBeOnTheScreen();
      expect(within(card()).getByLabelText("Carbs, 234 g")).toBeOnTheScreen();
      expect(within(card()).getByLabelText("Fat, 69 g")).toBeOnTheScreen();
    });

    it("should show the cap line when the 6,000 kcal maximum of a profile was reached", async () => {
      await renderEstimate({
        answers: {
          ...defaultAnswers,
          weightKg: 200,
          heightCm: 220,
          activity: "very",
          goal: "gain",
          ratePctPerWeek: 0.5,
        },
      });

      expect(
        within(card()).getByText(
          "Capped at 6,000 kcal, the most Ki-Lo sets. You would gain about 0.4 kg a week (0.21% of your weight), not 0.5%.",
        ),
      ).toBeOnTheScreen();
    });

    it("should add the macro fit line under the 30% deficit line when protein had to be lowered", async () => {
      await renderEstimate({
        answers: {
          ...defaultAnswers,
          birthDate: "1936-03-14",
          heightCm: 150,
          weightKg: 150,
          ratePctPerWeek: 1,
          proteinPreset: "very_high",
        },
      });

      expect(
        within(card()).getByText(
          "Kept to a 30% deficit, the most Ki-Lo sets. You would lose about 0.7 kg a week (0.50% of your weight), not 1.0%.",
        ),
      ).toBeOnTheScreen();
      expect(
        within(card()).getByText(
          "Protein was lowered to 311 g so that it fits in 1,920 kcal with the least fat Ki-Lo sets (75 g). Carbohydrate is 0 g.",
        ),
      ).toBeOnTheScreen();
    });

    it("should show the 20% surplus line for a gain that is too fast", async () => {
      await renderEstimate({
        answers: {
          ...defaultAnswers,
          sex: "female",
          heightCm: 150,
          weightKg: 50,
          activity: "sedentary",
          goal: "gain",
          ratePctPerWeek: 0.5,
        },
      });

      expect(
        within(card()).getByText(
          "Kept to a 20% surplus, the most Ki-Lo sets. You would gain about 0.2 kg a week (0.47% of your weight), not 0.5%.",
        ),
      ).toBeOnTheScreen();
    });

    it("should add the advice to see a professional when the floor is above the expenditure", async () => {
      await renderEstimate({
        answers: {
          ...defaultAnswers,
          sex: "female",
          birthDate: "1956-03-14",
          heightCm: 150,
          weightKg: 45,
          activity: "sedentary",
        },
      });

      expect(
        within(card()).getByText(
          "Raised to 1,200 kcal, the lowest target Ki-Lo sets for you. That is more than your estimated expenditure of 1,052 kcal, so you would gain about 0.1 kg a week (0.30% of your weight), not lose it. Talk to a doctor or dietitian before you try to lose more weight.",
        ),
      ).toBeOnTheScreen();
    });

    it("should add the macro fit line under the floor line when protein had to be lowered", async () => {
      await renderEstimate({
        answers: {
          ...defaultAnswers,
          birthDate: "1936-03-14",
          heightCm: 150,
          weightKg: 110,
          activity: "sedentary",
          ratePctPerWeek: 1,
          proteinPreset: "very_high",
        },
      });

      expect(
        within(card()).getByText(
          "Raised to 1,440 kcal, the lowest target Ki-Lo sets for you. You would lose about 0.4 kg a week (0.39% of your weight), not 1.0%.",
        ),
      ).toBeOnTheScreen();
      expect(
        within(card()).getByText(
          "Protein was lowered to 236 g so that it fits in 1,440 kcal with the least fat Ki-Lo sets (55 g). Carbohydrate is 0 g.",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("what every state carries", () => {
    const states: [string, RenderOptions][] = [
      ["the default", {}],
      ["a guardrail", { answers: floorAnswers }],
      ["saving", { isSaving: true }],
      ["a failed save", { saveFailed: true }],
      ["offline", { isOffline: true }],
    ];

    it.each(states)(
      "should label the estimate, name the expenditure and add the accuracy and medical lines in %s",
      async (_name, options) => {
        await renderEstimate(options);

        expect(within(card()).getByText("Estimate")).toBeOnTheScreen();
        expect(screen.getByText("Estimated expenditure")).toBeOnTheScreen();
        expect(
          screen.getByText(
            "This is a starting estimate from your answers. Each week, Ki-Lo checks it against your weigh-ins and food log and adjusts your targets.",
          ),
        ).toBeOnTheScreen();
        expect(
          screen.getByText(
            "Ki-Lo's estimates and targets are not medical advice. Speak to a doctor before you make big changes to your diet or your weight.",
          ),
        ).toBeOnTheScreen();
      },
    );

    it("should not draw the accuracy line from before the weekly check-in ran", async () => {
      await renderEstimate();

      expect(screen.queryByText(/it can be out by a few hundred kcal a day/)).toBeNull();
    });

    it("should draw the weekly check-in accuracy line on a settling recalculation too", async () => {
      await renderEstimate({ mode: "recalculate" });

      expect(
        screen.getByText(
          "This is a starting estimate from your answers. Each week, Ki-Lo checks it against your weigh-ins and food log and adjusts your targets.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Your starting targets" })).toBeOnTheScreen();
      expect(screen.getByText("The energy you use in a day")).toBeOnTheScreen();
    });
  });

  describe("after a check-in that measured", () => {
    const measured = { kind: "measured", measuredOn: "2026-10-23" } as const;

    it("should say Your new targets in place of Your starting targets", async () => {
      await renderEstimate({ mode: "recalculate", measurement: measured });

      expect(screen.getByRole("heading", { name: "Your new targets" })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Your starting targets" })).toBeNull();
    });

    it("should say the expenditure was measured from the weigh-ins and the food log", async () => {
      await renderEstimate({ mode: "recalculate", measurement: measured });

      expect(screen.getByText("Estimated expenditure")).toBeOnTheScreen();
      expect(screen.getByText("Measured from your weigh-ins and food log")).toBeOnTheScreen();
      expect(screen.queryByText("The energy you use in a day")).toBeNull();
    });

    it("should say when it was measured and that changing the answers changes only the targets", async () => {
      await renderEstimate({ mode: "recalculate", measurement: measured });

      expect(
        screen.getByText(
          "Ki-Lo measured your expenditure at your last check-in, on Friday 23 October. Changing your answers keeps it and changes only your targets.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/This is a starting estimate from your answers/)).toBeNull();
    });

    it("should keep the medical line, Save targets and Close", async () => {
      await renderEstimate({ mode: "recalculate", measurement: measured });

      expect(screen.getByText(/are not medical advice/)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Save targets" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Close" })).toBeOnTheScreen();
    });
  });

  describe("after check-ins that never measured", () => {
    const carriedForward = { kind: "carried-forward" } as const;

    it("should say Your new targets and that the expenditure is carried forward", async () => {
      await renderEstimate({ mode: "recalculate", measurement: carriedForward });

      expect(screen.getByRole("heading", { name: "Your new targets" })).toBeOnTheScreen();
      expect(screen.getByText("Carried forward from your last check-in")).toBeOnTheScreen();
      expect(screen.queryByText("Measured from your weigh-ins and food log")).toBeNull();
    });

    it("should say Ki-Lo has not measured it yet and that changing the answers changes only the targets", async () => {
      await renderEstimate({ mode: "recalculate", measurement: carriedForward });

      expect(
        screen.getByText(
          "Ki-Lo has not measured your expenditure yet, so it keeps the estimate from your last check-in. Changing your answers changes only your targets.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/This is a starting estimate from your answers/)).toBeNull();
    });
  });

  describe("the header", () => {
    it("should be titled Your estimate with no step line, a full bar and the heading Your starting targets", async () => {
      await renderEstimate();

      expect(screen.getByRole("heading", { name: "Your estimate" })).toBeOnTheScreen();
      expect(screen.queryByText(/^Step /)).toBeNull();
      expect(screen.getByRole("progressbar", { name: "Setup complete" })).toHaveProp(
        "aria-valuenow",
        100,
      );
      expect(screen.getByRole("heading", { name: "Your starting targets" })).toBeOnTheScreen();
    });

    it("should call onBack when Back is pressed", async () => {
      const user = userEvent.setup();
      await renderEstimate();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(handlers.onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("the footer", () => {
    it("should say Start on the first run and call onStart when it is pressed", async () => {
      const user = userEvent.setup();
      await renderEstimate({ mode: "first-run" });

      await user.press(startButton());

      expect(handlers.onStart).toHaveBeenCalledTimes(1);
    });

    it("should say Save targets when recalculating", async () => {
      await renderEstimate({ mode: "recalculate" });

      expect(screen.getByRole("button", { name: "Save targets" })).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    });
  });

  describe("saving", () => {
    it("should mark the button busy, show the spinner and ignore a press", async () => {
      const user = userEvent.setup();
      await renderEstimate({ isSaving: true });

      // The label is hidden under the spinner, so the button is found by being busy.
      const saving = screen.getByRole("button", { busy: true });
      await user.press(saving);

      expect(saving).toBeBusy();
      expect(within(saving).getByRole("progressbar")).toBeOnTheScreen();
      expect(handlers.onStart).not.toHaveBeenCalled();
    });

    it("should dim Back and Close and ignore a press on either", async () => {
      const user = userEvent.setup();
      await renderEstimate({ isSaving: true, mode: "recalculate" });

      await user.press(screen.getByRole("button", { name: "Back" }));
      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
      expect(handlers.onBack).not.toHaveBeenCalled();
      expect(handlers.onClose).not.toHaveBeenCalled();
    });

    it("should not be busy when it is not saving", async () => {
      await renderEstimate();

      expect(startButton()).not.toBeBusy();
    });
  });

  describe("a failed save", () => {
    it("should say so in an error banner above the button, and keep the answers", async () => {
      await renderEstimate({ saveFailed: true });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Not saved. Check your connection and try again.",
      );
      expect(within(card()).getByLabelText("Protein, 128 g")).toBeOnTheScreen();
    });

    it("should leave the button live as the retry", async () => {
      const user = userEvent.setup();
      await renderEstimate({ saveFailed: true });

      await user.press(startButton());

      expect(handlers.onStart).toHaveBeenCalledTimes(1);
    });

    it("should draw the banners above the button, the offline one first", async () => {
      await renderEstimate({ saveFailed: true, isOffline: true });

      expectAccessibleNamesInOrder(screen.getAllByRole(/^(status|alert|button)$/), [
        "Back",
        /offline/,
        /Not saved/,
        "Start",
      ]);
    });

    it("should draw no banner when the save has not failed", async () => {
      await renderEstimate();

      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("while the programme is being read", () => {
    it("should dim the button, with no banner, and ignore a press", async () => {
      const user = userEvent.setup();
      await renderEstimate({ mode: "recalculate", isWaitingForProgramme: true });

      expect(screen.getByRole("button", { name: "Save targets" })).toBeDisabled();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText("You're offline")).toBeNull();

      await user.press(screen.getByRole("button", { name: "Save targets" }));

      expect(handlers.onStart).not.toHaveBeenCalled();
    });

    it("should leave the button live when the programme is not being read", async () => {
      await renderEstimate({ mode: "recalculate", isWaitingForProgramme: false });

      expect(screen.getByRole("button", { name: "Save targets" })).toBeEnabled();
    });
  });

  describe("offline", () => {
    it("should say the app is offline and dim the button", async () => {
      const user = userEvent.setup();
      await renderEstimate({ isOffline: true });

      await user.press(startButton());

      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(startButton()).toBeDisabled();
      expect(handlers.onStart).not.toHaveBeenCalled();
    });

    it("should draw no offline banner when online", async () => {
      await renderEstimate();

      expect(screen.queryByText("You're offline")).toBeNull();
    });
  });

  describe("the flourish", () => {
    it("should draw no slash and play no haptic with reduce motion on", async () => {
      await renderEstimate();

      expect(slashes()).toHaveLength(0);
      expect(jest.mocked(Haptics.impactAsync)).not.toHaveBeenCalled();
    });

    it("should draw the slash once and play the confirm haptic once with reduce motion off", async () => {
      reduceMotion(false);
      await renderEstimate();

      expect(slashes()).toHaveLength(1);
      // 45 percent of the card wide: the card variant of the kit's slash, and not the row's 16.
      expect(slashes()[0]?.parent).toHaveStyle({ width: "45%" });
      expect(jest.mocked(Haptics.impactAsync)).toHaveBeenCalledTimes(1);
      expect(jest.mocked(Haptics.impactAsync)).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium,
      );
    });

    it("should count up to the target and settle on it with reduce motion off", async () => {
      reduceMotion(false);
      await renderEstimate();

      expect(await within(card()).findByText("1,970")).toBeOnTheScreen();
    });
  });
});
