import { cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { QuestionScreen } from "../../components/GoalQuestionnaire";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { expectAccessibleNamesInOrder } from "../support/namesInOrder";
import { registerAppStyles } from "../support/nativeWindStyles";
import { viewsDrawn } from "../support/viewsDrawn";

import type { QuestionScreenProps } from "../../components/GoalQuestionnaire";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const frame = { x: 0, y: 0, width: 390, height: 844 };

const baseProps: Omit<QuestionScreenProps, "children"> = {
  step: 2,
  title: "Anything to focus on?",
  help: "Pick any that matter to you, or Overall.",
  note: null,
  isNextEnabled: true,
  onClose: () => undefined,
  onBack: () => undefined,
  onNext: () => undefined,
};

async function renderQuestion(
  props: Partial<Omit<QuestionScreenProps, "children">> = {},
  insets = { top: 47, bottom: 34 },
) {
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets: { ...insets, left: 0, right: 0 } }}>
      <ThemeProvider fixedPreference="dark">
        <QuestionScreen {...baseProps} {...props}>
          <Text>The answers of the question</Text>
        </QuestionScreen>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

describe("QuestionScreen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  describe("the question", () => {
    it("should head the screen with the title and put the help line under it", async () => {
      await renderQuestion();

      expect(screen.getByRole("heading", { name: "Anything to focus on?" })).toBeOnTheScreen();
      expect(screen.getByText("Pick any that matter to you, or Overall.")).toBeOnTheScreen();
    });

    it("should draw the answers it is given", async () => {
      await renderQuestion();

      expect(screen.getByText("The answers of the question")).toBeOnTheScreen();
    });

    it("should draw the note under the answers when the question has one", async () => {
      await renderQuestion({
        note: "Your routine keeps its own days. This only shapes suggestions.",
      });

      expect(
        screen.getByText("Your routine keeps its own days. This only shapes suggestions."),
      ).toBeOnTheScreen();
    });

    it("should draw no note when the question has none", async () => {
      await renderQuestion({ note: null });

      expect(screen.queryByText(/routine keeps/)).not.toBeOnTheScreen();
    });
  });

  describe("the header", () => {
    it("should say which question of the six it is", async () => {
      await renderQuestion({ step: 2 });

      expect(screen.getByText("Your goal · 2 of 6")).toBeOnTheScreen();
    });

    it("should name the question for a screen reader as Question n of 6", async () => {
      await renderQuestion({ step: 4 });

      expect(screen.getByText("Your goal · 4 of 6")).toHaveAccessibleName("Question 4 of 6");
    });

    it.each([
      [1, 17],
      [2, 33],
      [3, 50],
      [4, 67],
      [5, 83],
      [6, 100],
    ])(
      "should fill the progress bar to the share of six answered at step %s",
      async (step, now) => {
        await renderQuestion({ step });

        expect(
          screen.getByRole("progressbar", { name: "Questions answered" }),
        ).toHaveAccessibilityValue({
          min: 0,
          max: 100,
          now,
        });
      },
    );

    it("should have a Close button that says the answers are not saved", async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      await renderQuestion({ onClose });

      await user.press(screen.getByRole("button", { name: "Close, your answers are not saved" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should put Close first, before the answers and the footer", async () => {
      await renderQuestion();

      expectAccessibleNamesInOrder(screen.getAllByRole("button"), [
        "Close, your answers are not saved",
        "Back",
        "Next",
      ]);
    });
  });

  describe("the footer", () => {
    it("should have Back and Next from the second question", async () => {
      await renderQuestion({ step: 2 });

      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Next" })).toBeOnTheScreen();
    });

    it("should have no Back on the first question", async () => {
      await renderQuestion({ step: 1, onBack: undefined });

      expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Next" })).toBeOnTheScreen();
    });

    it("should call onBack when Back is pressed", async () => {
      const user = userEvent.setup();
      const onBack = jest.fn();
      await renderQuestion({ onBack });

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should call onNext when Next is pressed", async () => {
      const user = userEvent.setup();
      const onNext = jest.fn();
      await renderQuestion({ onNext });

      await user.press(screen.getByRole("button", { name: "Next" }));

      expect(onNext).toHaveBeenCalledTimes(1);
    });

    it("should disable Next, and not call onNext, until the question is answered", async () => {
      const user = userEvent.setup();
      const onNext = jest.fn();
      await renderQuestion({ isNextEnabled: false, onNext });

      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: "Next" }));

      expect(onNext).not.toHaveBeenCalled();
    });

    it("should leave Back alive while Next is disabled", async () => {
      await renderQuestion({ isNextEnabled: false });

      expect(screen.getByRole("button", { name: "Back" })).toBeEnabled();
    });

    it.each([1, 2, 3, 4, 5])("should label the main button Next at question %s", async (step) => {
      await renderQuestion({ step });

      expect(screen.getByRole("button", { name: "Next" })).toBeOnTheScreen();
    });

    it("should label the main button See your priorities at the sixth question", async () => {
      await renderQuestion({ step: 6 });

      expect(screen.getByRole("button", { name: "See your priorities" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Next" })).not.toBeOnTheScreen();
    });

    it("should give Next twice the width of Back, as the board's footer does", async () => {
      await renderQuestion();

      expect(viewsDrawn({ flexGrow: 2 })).toHaveLength(1);
    });
  });

  describe("on a phone with insets", () => {
    it("should sit the whole screen under the top inset", async () => {
      await renderQuestion({}, { top: 47, bottom: 34 });

      expect(viewsDrawn({ paddingTop: 47, backgroundColor: "rgba(11, 14, 19, 1)" })).toHaveLength(
        1,
      );
    });

    it("should put the footer on the bottom inset, with 12 points above its buttons", async () => {
      await renderQuestion({}, { top: 47, bottom: 34 });

      expect(viewsDrawn({ borderTopWidth: 1, paddingTop: 12, paddingBottom: 34 })).toHaveLength(1);
    });

    it("should keep 12 points under the footer when there is no bottom inset", async () => {
      await renderQuestion({}, { top: 24, bottom: 0 });

      expect(viewsDrawn({ borderTopWidth: 1, paddingTop: 12, paddingBottom: 12 })).toHaveLength(1);
    });
  });
});
