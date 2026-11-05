import {
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  FULL_GYM,
  GOAL_QUESTIONNAIRE,
  GOAL_QUESTIONS,
  MINUTES_PRESETS,
  describeMinutesOption,
} from "@keylow/core/copy";
import { EQUIPMENT } from "@keylow/core/training";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { GoalDraftProvider, GoalQuestionScreen } from "../../components/GoalQuestionnaire";
import { goalQuestionPath, goalSummaryPath } from "../../lib/goalRoutes";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { expectAccessibleNamesInOrder } from "../support/namesInOrder";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { GoalDraftAnswers, GoalQuestionScreenProps } from "../../components/GoalQuestionnaire";

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

async function renderQuestion(
  step: GoalQuestionScreenProps["step"],
  initialAnswers?: GoalDraftAnswers,
) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <GoalDraftProvider initialAnswers={initialAnswers}>
        <GoalQuestionScreen step={step} />
      </GoalDraftProvider>
    </ThemeProvider>,
  );
}

// The role query does not resolve a text input, so the Other minutes field is found by its label, which
// the kit gives the unit.
const otherMinutesField = () => screen.getByLabelText("Other (min)");
const nextButton = () => screen.getByRole("button", { name: "Next" });
const checkedChips = () => screen.queryAllByRole("checkbox", { checked: true });

const equipmentLabels = EQUIPMENT.map((value) => EQUIPMENT_OPTIONS[value].label);
const fullGymLabels = FULL_GYM.equipment.map((value) => EQUIPMENT_OPTIONS[value].label);

describe("the last three goal questions", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("the minutes question", () => {
    it("should ask the question with its help line and note", async () => {
      await renderQuestion("minutes");

      expect(screen.getByRole("heading", { name: "How long is a session?" })).toBeOnTheScreen();
      expect(screen.getByText(GOAL_QUESTIONS.minutes.help)).toBeOnTheScreen();
      expect(screen.getByText("Other takes 15 to 180 minutes.")).toBeOnTheScreen();
      expect(screen.getByText("Your goal · 4 of 6")).toBeOnTheScreen();
    });

    it("should offer the five presets and Other as a radio group of chips named by the question", async () => {
      await renderQuestion("minutes");

      expect(screen.getByLabelText("How long is a session?")).toHaveProp("role", "radiogroup");
      expectAccessibleNamesInOrder(screen.getAllByRole("radio"), [
        ...MINUTES_PRESETS.map(describeMinutesOption),
        GOAL_QUESTIONNAIRE.otherMinutesOption,
      ]);
    });

    it("should have nothing chosen, no field and Next disabled at first", async () => {
      await renderQuestion("minutes");

      for (const chip of screen.getAllByRole("radio")) {
        expect(chip).not.toBeChecked();
      }
      expect(screen.queryByLabelText("Other (min)")).not.toBeOnTheScreen();
      expect(nextButton()).toBeDisabled();
    });

    it("should mark the preset that is chosen and enable Next", async () => {
      const user = userEvent.setup();
      await renderQuestion("minutes");

      await user.press(screen.getByRole("radio", { name: "60 min" }));

      expect(screen.getByRole("radio", { name: "60 min" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "45 min" })).not.toBeChecked();
      expect(nextButton()).toBeEnabled();
    });

    it("should open with the current goal's preset chosen", async () => {
      await renderQuestion("minutes", { session_minutes: 75 });

      expect(screen.getByRole("radio", { name: "75 min" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "Other" })).not.toBeChecked();
      expect(screen.queryByLabelText("Other (min)")).not.toBeOnTheScreen();
    });

    it("should open with Other chosen and its field filled when the current goal's minutes are no preset", async () => {
      await renderQuestion("minutes", { session_minutes: 50 });

      expect(screen.getByRole("radio", { name: "Other" })).toBeChecked();
      expect(otherMinutesField()).toHaveDisplayValue("50");
      expect(nextButton()).toBeEnabled();
    });

    it("should show the field with Next disabled when Other is chosen, and take the preset back", async () => {
      const user = userEvent.setup();
      await renderQuestion("minutes", { session_minutes: 60 });

      await user.press(screen.getByRole("radio", { name: "Other" }));

      expect(screen.getByRole("radio", { name: "Other" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "60 min" })).not.toBeChecked();
      expect(otherMinutesField()).toHaveDisplayValue("");
      expect(nextButton()).toBeDisabled();
    });

    it("should draw the unit after the digits of the field", async () => {
      const user = userEvent.setup();
      await renderQuestion("minutes");

      await user.press(screen.getByRole("radio", { name: "Other" }));

      // The unit is hidden from a screen reader, which reads it in the field's name.
      expect(screen.getByText("min", { includeHiddenElements: true })).toBeOnTheScreen();
    });

    it("should enable Next for minutes inside the range typed in the field", async () => {
      const user = userEvent.setup();
      await renderQuestion("minutes");
      await user.press(screen.getByRole("radio", { name: "Other" }));

      await user.type(otherMinutesField(), "50");

      expect(nextButton()).toBeEnabled();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it.each(["15", "180"])("should accept %s, an end of the range", async (minutes) => {
      const user = userEvent.setup();
      await renderQuestion("minutes");
      await user.press(screen.getByRole("radio", { name: "Other" }));

      await user.type(otherMinutesField(), minutes);

      expect(nextButton()).toBeEnabled();
    });

    it.each(["14", "181", "0"])(
      "should show the rule and block Next for %s minutes",
      async (minutes) => {
        const user = userEvent.setup();
        await renderQuestion("minutes");
        await user.press(screen.getByRole("radio", { name: "Other" }));

        await user.type(otherMinutesField(), minutes);

        expect(screen.getByRole("alert")).toHaveTextContent("Enter minutes from 15 to 180.");
        expect(nextButton()).toBeDisabled();
      },
    );

    it("should drop what is not a digit from the field", async () => {
      const user = userEvent.setup();
      await renderQuestion("minutes");
      await user.press(screen.getByRole("radio", { name: "Other" }));

      await user.type(otherMinutesField(), "4a5.");

      expect(otherMinutesField()).toHaveDisplayValue("45");
    });

    it("should block Next and show no rule again once the field is emptied", async () => {
      const user = userEvent.setup();
      await renderQuestion("minutes", { session_minutes: 50 });

      await user.clear(otherMinutesField());

      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(nextButton()).toBeDisabled();
    });

    it("should hide the field and use the preset when a preset is chosen after Other", async () => {
      const user = userEvent.setup();
      await renderQuestion("minutes");
      await user.press(screen.getByRole("radio", { name: "Other" }));
      await user.type(otherMinutesField(), "7");

      await user.press(screen.getByRole("radio", { name: "90 min" }));

      expect(screen.queryByLabelText("Other (min)")).not.toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
      expect(nextButton()).toBeEnabled();
    });

    it("should go on to the fifth question when Next is pressed", async () => {
      const user = userEvent.setup();
      await renderQuestion("minutes", { session_minutes: 45 });

      await user.press(nextButton());

      expect(routerMock.push).toHaveBeenCalledWith(goalQuestionPath(5));
    });
  });

  describe("the equipment question", () => {
    it("should ask the question with its help line and note", async () => {
      await renderQuestion("equipment");

      expect(screen.getByRole("heading", { name: "What can you use?" })).toBeOnTheScreen();
      expect(screen.getByText(GOAL_QUESTIONS.equipment.help)).toBeOnTheScreen();
      expect(screen.getByText("Full gym picks everything but Other.")).toBeOnTheScreen();
      expect(screen.getByText("Your goal · 5 of 6")).toBeOnTheScreen();
    });

    it("should offer Full gym and the ten values as a group of checkbox chips named by the question", async () => {
      await renderQuestion("equipment");

      expect(screen.getByLabelText("What can you use?")).toHaveProp("role", "group");
      expectAccessibleNamesInOrder(screen.getAllByRole("checkbox"), [
        FULL_GYM.label,
        ...equipmentLabels,
      ]);
    });

    it("should have nothing chosen and Next disabled at first", async () => {
      await renderQuestion("equipment");

      expect(checkedChips()).toHaveLength(0);
      expect(nextButton()).toBeDisabled();
    });

    it("should let several values be chosen and enable Next", async () => {
      const user = userEvent.setup();
      await renderQuestion("equipment");

      await user.press(screen.getByRole("checkbox", { name: "Barbell" }));
      await user.press(screen.getByRole("checkbox", { name: "Band" }));

      expectAccessibleNamesInOrder(checkedChips(), ["Barbell", "Band"]);
      expect(nextButton()).toBeEnabled();
    });

    it("should need at least one value, so Next is disabled again when the last one is cleared", async () => {
      const user = userEvent.setup();
      await renderQuestion("equipment", { equipment: ["barbell"] });
      expect(nextButton()).toBeEnabled();

      await user.press(screen.getByRole("checkbox", { name: "Barbell" }));

      expect(checkedChips()).toHaveLength(0);
      expect(nextButton()).toBeDisabled();
    });

    it("should accept Other alone", async () => {
      const user = userEvent.setup();
      await renderQuestion("equipment");

      await user.press(screen.getByRole("checkbox", { name: "Other" }));

      expect(nextButton()).toBeEnabled();
    });

    it("should choose the nine values but Other, and Full gym itself, when Full gym is pressed", async () => {
      const user = userEvent.setup();
      await renderQuestion("equipment");

      await user.press(screen.getByRole("checkbox", { name: "Full gym" }));

      expect(fullGymLabels).toHaveLength(9);
      expectAccessibleNamesInOrder(checkedChips(), ["Full gym", ...fullGymLabels]);
      expect(screen.getByRole("checkbox", { name: "Other" })).not.toBeChecked();
      expect(nextButton()).toBeEnabled();
    });

    it("should clear every value when Full gym is pressed a second time", async () => {
      const user = userEvent.setup();
      await renderQuestion("equipment");

      await user.press(screen.getByRole("checkbox", { name: "Full gym" }));
      await user.press(screen.getByRole("checkbox", { name: "Full gym" }));

      expect(checkedChips()).toHaveLength(0);
      expect(nextButton()).toBeDisabled();
    });

    it("should draw Full gym chosen when the nine values are chosen one by one", async () => {
      const user = userEvent.setup();
      await renderQuestion("equipment", { equipment: FULL_GYM.equipment.slice(0, 8) });
      expect(screen.getByRole("checkbox", { name: "Full gym" })).not.toBeChecked();

      await user.press(screen.getByRole("checkbox", { name: "Bodyweight" }));

      expect(screen.getByRole("checkbox", { name: "Full gym" })).toBeChecked();
    });

    it("should draw Full gym unchosen, and keep the other eight, when one of the nine is cleared", async () => {
      const user = userEvent.setup();
      await renderQuestion("equipment", { equipment: [...FULL_GYM.equipment] });

      await user.press(screen.getByRole("checkbox", { name: "Cable" }));

      expect(screen.getByRole("checkbox", { name: "Full gym" })).not.toBeChecked();
      expect(checkedChips()).toHaveLength(8);
    });

    it("should leave Other out when Full gym is pressed after Other was chosen", async () => {
      const user = userEvent.setup();
      await renderQuestion("equipment", { equipment: ["other"] });

      await user.press(screen.getByRole("checkbox", { name: "Full gym" }));

      expect(screen.getByRole("checkbox", { name: "Other" })).not.toBeChecked();
      expectAccessibleNamesInOrder(checkedChips(), ["Full gym", ...fullGymLabels]);
    });

    it("should open with the current goal's equipment chosen", async () => {
      await renderQuestion("equipment", { equipment: ["dumbbell", "cable"] });

      expectAccessibleNamesInOrder(checkedChips(), ["Dumbbell", "Cable"]);
    });

    it("should go on to the sixth question when Next is pressed", async () => {
      const user = userEvent.setup();
      await renderQuestion("equipment", { equipment: ["machine"] });

      await user.press(nextButton());

      expect(routerMock.push).toHaveBeenCalledWith(goalQuestionPath(6));
    });
  });

  describe("the experience question", () => {
    it("should ask the question with the agreed help line", async () => {
      await renderQuestion("experience");

      expect(screen.getByRole("heading", { name: "How long have you trained?" })).toBeOnTheScreen();
      expect(screen.getByText(GOAL_QUESTIONS.experience.help)).toBeOnTheScreen();
      expect(screen.getByText("Your goal · 6 of 6")).toBeOnTheScreen();
    });

    it("should offer Beginner, Intermediate and Advanced as radio cards with their descriptions", async () => {
      await renderQuestion("experience");

      expect(screen.getByLabelText("How long have you trained?")).toHaveProp("role", "radiogroup");
      expectAccessibleNamesInOrder(
        screen.getAllByRole("radio"),
        Object.values(EXPERIENCE_OPTIONS).map(
          ({ label, description }) => `${label}, ${description}`,
        ),
      );
    });

    it("should word the main button as See your priorities and disable it until a card is chosen", async () => {
      await renderQuestion("experience");

      expect(screen.queryByRole("button", { name: "Next" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "See your priorities" })).toBeDisabled();
    });

    it("should mark the card that is chosen and enable the button", async () => {
      const user = userEvent.setup();
      await renderQuestion("experience");

      await user.press(screen.getByRole("radio", { name: /^Advanced/ }));

      expect(screen.getByRole("radio", { name: /^Advanced/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Beginner/ })).not.toBeChecked();
      expect(screen.getByRole("button", { name: "See your priorities" })).toBeEnabled();
    });

    it("should open with the current goal's experience chosen", async () => {
      await renderQuestion("experience", { experience: "intermediate" });

      expect(screen.getByRole("radio", { name: /^Intermediate/ })).toBeChecked();
    });

    it("should lead to the summary when See your priorities is pressed", async () => {
      const user = userEvent.setup();
      await renderQuestion("experience", { experience: "beginner" });

      await user.press(screen.getByRole("button", { name: "See your priorities" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(goalSummaryPath());
    });
  });
});
