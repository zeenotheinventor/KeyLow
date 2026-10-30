import { FOCUS_OPTIONS, GOAL_OPTIONS, GOAL_QUESTIONNAIRE, GOAL_QUESTIONS } from "@keylow/core/copy";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { GoalDraftProvider, GoalQuestionScreen } from "../../components/GoalQuestionnaire";
import { goalQuestionPath } from "../../lib/goalRoutes";
import { trainPath } from "../../lib/routineRoutes";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { expectAccessibleNamesInOrder } from "../support/namesInOrder";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

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

// The handlers registered for the Android back button, the last one asked first.
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

describe("GoalQuestionScreen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    backPressHandlers.length = 0;
    jest.spyOn(BackHandler, "addEventListener").mockImplementation((_eventName, handler) => {
      backPressHandlers.push(handler);
      return {
        remove: () => {
          backPressHandlers.splice(backPressHandlers.indexOf(handler), 1);
        },
      };
    });
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  describe("the goal question", () => {
    it("should ask the question with the help line of the boards", async () => {
      await renderQuestion("goal");

      expect(screen.getByRole("heading", { name: "What are you training for?" })).toBeOnTheScreen();
      expect(screen.getByText(GOAL_QUESTIONS.goal.help)).toBeOnTheScreen();
      expect(screen.getByText("Your goal · 1 of 6")).toBeOnTheScreen();
    });

    it("should offer Look better, Get stronger and Both as radio cards with their descriptions, in that order", async () => {
      await renderQuestion("goal");

      const cards = screen.getAllByRole("radio");
      expect(cards).toHaveLength(3);
      expect(cards[0]).toHaveAccessibleName(
        "Look better, Build muscle where it shows, in proportion",
      );
      expect(cards[1]).toHaveAccessibleName(
        "Get stronger, Lift more on the squat, bench, deadlift and overhead press",
      );
      expect(cards[2]).toHaveAccessibleName(
        "Both, Strength on the big lifts, size everywhere else",
      );
      expect(screen.getByText(GOAL_OPTIONS.hybrid.description)).toBeOnTheScreen();
    });

    it("should name the radio group by the question", async () => {
      await renderQuestion("goal");

      expect(screen.getByLabelText("What are you training for?")).toHaveProp("role", "radiogroup");
    });

    it("should have nothing chosen and Next disabled at first", async () => {
      await renderQuestion("goal");

      for (const card of screen.getAllByRole("radio")) {
        expect(card).not.toBeChecked();
      }
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });

    it("should mark the card that is chosen and enable Next", async () => {
      const user = userEvent.setup();
      await renderQuestion("goal");

      await user.press(screen.getByRole("radio", { name: /^Get stronger/ }));

      expect(screen.getByRole("radio", { name: /^Get stronger/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Look better/ })).not.toBeChecked();
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    it("should move the choice when another card is pressed", async () => {
      const user = userEvent.setup();
      await renderQuestion("goal");

      await user.press(screen.getByRole("radio", { name: /^Look better/ }));
      await user.press(screen.getByRole("radio", { name: /^Both/ }));

      expect(screen.getByRole("radio", { name: /^Both/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /^Look better/ })).not.toBeChecked();
    });

    it("should open filled with the current goal's answers when it is given them", async () => {
      await renderQuestion("goal", { goal: "hybrid" });

      expect(screen.getByRole("radio", { name: /^Both/ })).toBeChecked();
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    it("should have no Back on the first question", async () => {
      await renderQuestion("goal");

      expect(screen.queryByRole("button", { name: "Back" })).not.toBeOnTheScreen();
    });

    it("should go on to the second question when Next is pressed", async () => {
      const user = userEvent.setup();
      await renderQuestion("goal", { goal: "aesthetic" });

      await user.press(screen.getByRole("button", { name: "Next" }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(goalQuestionPath(2));
    });
  });

  describe("the focus question", () => {
    it("should ask the question with its help line and offer the six focuses as checkbox cards in the boards' order", async () => {
      await renderQuestion("focus");

      expect(screen.getByRole("heading", { name: "Anything to focus on?" })).toBeOnTheScreen();
      expect(screen.getByText("Pick any that matter to you, or Overall.")).toBeOnTheScreen();
      expect(screen.getByText("Your goal · 2 of 6")).toBeOnTheScreen();
      const cards = screen.getAllByRole("checkbox");
      expect(cards).toHaveLength(6);
      expectAccessibleNamesInOrder(
        cards,
        Object.values(FOCUS_OPTIONS).map(({ label, description }) => `${label}, ${description}`),
      );
    });

    it("should name the group by the question, as a plain group", async () => {
      await renderQuestion("focus");

      expect(screen.getByLabelText("Anything to focus on?")).toHaveProp("role", "group");
    });

    it("should have Next enabled with nothing chosen, as the schema allows an empty focus", async () => {
      await renderQuestion("focus");

      for (const card of screen.getAllByRole("checkbox")) {
        expect(card).not.toBeChecked();
      }
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    it("should let more than one be chosen", async () => {
      const user = userEvent.setup();
      await renderQuestion("focus");

      await user.press(screen.getByRole("checkbox", { name: /^Chest/ }));
      await user.press(screen.getByRole("checkbox", { name: /^Glutes/ }));

      expect(screen.getByRole("checkbox", { name: /^Chest/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /^Glutes/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /^Arms/ })).not.toBeChecked();
    });

    it("should clear a chosen card when it is pressed again", async () => {
      const user = userEvent.setup();
      await renderQuestion("focus", { focus: ["chest"] });

      await user.press(screen.getByRole("checkbox", { name: /^Chest/ }));

      expect(screen.getByRole("checkbox", { name: /^Chest/ })).not.toBeChecked();
    });

    it("should have Back and return to the first question with it", async () => {
      const user = userEvent.setup();
      await renderQuestion("focus");

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go on to the third question when Next is pressed", async () => {
      const user = userEvent.setup();
      await renderQuestion("focus");

      await user.press(screen.getByRole("button", { name: "Next" }));

      expect(routerMock.push).toHaveBeenCalledWith(goalQuestionPath(3));
    });
  });

  describe("the days question", () => {
    it("should ask the question with its help line and note", async () => {
      await renderQuestion("days");

      expect(screen.getByRole("heading", { name: "How many days a week?" })).toBeOnTheScreen();
      expect(screen.getByText("The days you can train in a normal week.")).toBeOnTheScreen();
      expect(
        screen.getByText("Your routine keeps its own days. This only shapes suggestions."),
      ).toBeOnTheScreen();
      expect(screen.getByText("Your goal · 3 of 6")).toBeOnTheScreen();
    });

    it("should offer 1 to 7 as a radio group of chips named by the question", async () => {
      await renderQuestion("days");

      expect(screen.getByLabelText("How many days a week?")).toHaveProp("role", "radiogroup");
      expectAccessibleNamesInOrder(screen.getAllByRole("radio"), [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
      ]);
    });

    it("should draw the chips 44 points high, as the board does", async () => {
      await renderQuestion("days");

      expect(screen.getByRole("radio", { name: "4" })).toHaveStyle({ height: 44 });
    });

    it("should have nothing chosen and Next disabled at first", async () => {
      await renderQuestion("days");

      for (const chip of screen.getAllByRole("radio")) {
        expect(chip).not.toBeChecked();
      }
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });

    it("should mark the day that is chosen and enable Next", async () => {
      const user = userEvent.setup();
      await renderQuestion("days");

      await user.press(screen.getByRole("radio", { name: "4" }));

      expect(screen.getByRole("radio", { name: "4" })).toBeChecked();
      expect(screen.getByRole("radio", { name: "3" })).not.toBeChecked();
      expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    });

    it("should open filled with the current goal's days", async () => {
      await renderQuestion("days", { days_per_week: 6 });

      expect(screen.getByRole("radio", { name: "6" })).toBeChecked();
    });

    it("should lead on to the fourth question, which the next ticket builds", async () => {
      const user = userEvent.setup();
      await renderQuestion("days", { days_per_week: 4 });

      await user.press(screen.getByRole("button", { name: "Next" }));

      expect(routerMock.push).toHaveBeenCalledWith(goalQuestionPath(4));
    });
  });

  describe("a question whose answers are not built yet", () => {
    it.each(["minutes", "equipment", "experience"] as const)(
      "should still ask the %s question, with the main button disabled",
      async (step) => {
        await renderQuestion(step);

        expect(screen.getByRole("heading", { name: GOAL_QUESTIONS[step].title })).toBeOnTheScreen();
        expect(screen.getByRole("button", { name: /^(Next|See your priorities)$/ })).toBeDisabled();
      },
    );

    it("should word Next as See your priorities at the sixth question", async () => {
      await renderQuestion("experience");

      expect(
        screen.getByRole("button", { name: GOAL_QUESTIONNAIRE.finalAction }),
      ).toBeOnTheScreen();
    });
  });

  describe("closing", () => {
    it("should leave at once when nothing has been answered", async () => {
      const user = userEvent.setup();
      await renderQuestion("goal");

      await user.press(screen.getByRole("button", { name: "Close, your answers are not saved" }));

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      expect(screen.queryByText(GOAL_QUESTIONNAIRE.closeConfirmation)).not.toBeOnTheScreen();
    });

    it("should ask first when there are answers", async () => {
      const user = userEvent.setup();
      await renderQuestion("goal", { goal: "strength" });

      await user.press(screen.getByRole("button", { name: "Close, your answers are not saved" }));

      expect(screen.getByRole("heading", { name: "Your answers are not saved" })).toBeOnTheScreen();
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    });

    it("should ask first when only a focus has been chosen", async () => {
      const user = userEvent.setup();
      await renderQuestion("focus", { focus: ["legs"] });

      await user.press(screen.getByRole("button", { name: "Close, your answers are not saved" }));

      expect(screen.getByRole("heading", { name: "Your answers are not saved" })).toBeOnTheScreen();
    });

    it("should draw Close as the main button and Keep answering as the secondary one", async () => {
      const user = userEvent.setup();
      await renderQuestion("goal", { goal: "strength" });
      await user.press(screen.getByRole("button", { name: "Close, your answers are not saved" }));

      expect(await screen.findByRole("button", { name: "Close" })).toHaveStyle({
        backgroundColor: resolvedColor("dark", "accent"),
      });
      expect(screen.getByRole("button", { name: "Keep answering" })).toHaveStyle({
        backgroundColor: resolvedColor("dark", "surface-raised"),
      });
    });

    it("should stay on the question when the person keeps answering", async () => {
      const user = userEvent.setup();
      await renderQuestion("goal", { goal: "strength" });
      await user.press(screen.getByRole("button", { name: "Close, your answers are not saved" }));

      await user.press(screen.getByRole("button", { name: "Keep answering" }));

      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("heading", { name: "Your answers are not saved" }),
      ).not.toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: /^Get stronger/ })).toBeChecked();
    });

    it("should leave the flow when the person closes it, and keep nothing", async () => {
      const user = userEvent.setup();
      await renderQuestion("goal", { goal: "strength" });
      await user.press(screen.getByRole("button", { name: "Close, your answers are not saved" }));

      await user.press(screen.getByRole("button", { name: "Close" }));

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should go to the Train tab when a cold link has nothing to go back to", async () => {
      routerMock.parentCanGoBack.mockReturnValue(false);
      const user = userEvent.setup();
      await renderQuestion("goal");

      await user.press(screen.getByRole("button", { name: "Close, your answers are not saved" }));

      expect(routerMock.replace).toHaveBeenCalledWith(trainPath());
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    });
  });

  describe("the Android back button", () => {
    it("should close the first question as Close does, asking first when there are answers", async () => {
      await renderQuestion("goal", { goal: "strength" });

      const wasHandled = await pressAndroidBackButton();

      expect(wasHandled).toBe(true);
      expect(
        await screen.findByRole("heading", { name: "Your answers are not saved" }),
      ).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should leave the first question at once when nothing has been answered", async () => {
      await renderQuestion("goal");

      await pressAndroidBackButton();

      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should go back a question, as Back does, from a later one", async () => {
      await renderQuestion("days", { days_per_week: 3 });

      const wasHandled = await pressAndroidBackButton();

      expect(wasHandled).toBe(true);
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
  });
});
