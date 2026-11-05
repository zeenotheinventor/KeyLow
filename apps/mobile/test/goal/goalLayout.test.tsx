import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

import GoalLayout from "../../app/goal/_layout";
import { GoalQuestionScreen } from "../../components/GoalQuestionnaire";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import {
  resetTrainingGoalsRead,
  storedGoalRow,
  trainingGoalsRead,
} from "../support/trainingGoalsRead";

import type { GoalQuestionStep } from "@keylow/core/copy";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../../lib/useReadsEnabled", () => ({
  useReadsEnabled: jest.requireActual<{ useReadsEnabledMock: unknown }>(
    "../support/trainingGoalsRead",
  ).useReadsEnabledMock,
}));
jest.mock("@keylow/api-client", () => ({
  useTrainingGoals: jest.requireActual<{ useTrainingGoalsMock: unknown }>(
    "../support/trainingGoalsRead",
  ).useTrainingGoalsMock,
}));

// The stack the layout draws, as a stand-in that keeps the options it was given and draws the question a
// test asks for inside it, so the answers the layout holds are read the way the questions read them.
const mockStackOptions: unknown[] = [];
let mockQuestion: GoalQuestionStep | undefined;
jest.mock("expo-router", () => {
  const { mockExpoRouter } = jest.requireActual<{
    mockExpoRouter: { Stack: { Screen: unknown } };
  }>("../support/expoRouterMock");
  const { createElement } = jest.requireActual<typeof import("react")>("react");

  return {
    ...mockExpoRouter,
    Stack: Object.assign(({ screenOptions }: { screenOptions: unknown }) => {
      mockStackOptions.push(screenOptions);
      return mockQuestion === undefined
        ? null
        : createElement(
            jest.requireActual<{
              GoalQuestionScreen: typeof GoalQuestionScreen;
            }>("../../components/GoalQuestionnaire").GoalQuestionScreen,
            { step: mockQuestion },
          );
    }, mockExpoRouter.Stack),
  };
});

async function renderLayout() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <GoalLayout />
      <Text>after the layout</Text>
    </ThemeProvider>,
  );
}

describe("the goal layout", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetTrainingGoalsRead();
    mockStackOptions.length = 0;
    mockQuestion = undefined;
  });

  it("should switch the iOS edge swipe off for the flow, so it cannot be left without the question", async () => {
    await renderLayout();

    expect(routerMock.screenOptions).toContainEqual({ gestureEnabled: false });
  });

  it("should draw its stack with no header and the edge swipe off for each question", async () => {
    await renderLayout();

    expect(mockStackOptions).toContainEqual(
      expect.objectContaining({ headerShown: false, gestureEnabled: false }),
    );
  });

  describe("while the current goal is read", () => {
    it("should draw no question yet, so a goal is not shown empty and then filled", async () => {
      trainingGoalsRead.status = "pending";
      mockQuestion = "goal";

      await renderLayout();

      expect(mockStackOptions).toHaveLength(0);
      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
    });

    it("should leave the edge swipe on while it waits, and turn it off once the questions show", async () => {
      trainingGoalsRead.status = "pending";
      await renderLayout();

      expect(routerMock.screenOptions.at(-1)).toEqual({ gestureEnabled: true });

      trainingGoalsRead.status = "ready";
      await screen.rerender(
        <ThemeProvider fixedPreference="dark">
          <GoalLayout />
          <Text>after the layout</Text>
        </ThemeProvider>,
      );

      expect(routerMock.screenOptions.at(-1)).toEqual({ gestureEnabled: false });
    });

    it("should draw the questions once the read arrives, filled with the goal", async () => {
      trainingGoalsRead.status = "pending";
      mockQuestion = "goal";
      await renderLayout();

      trainingGoalsRead.status = "ready";
      trainingGoalsRead.row = storedGoalRow;
      await screen.rerender(
        <ThemeProvider fixedPreference="dark">
          <GoalLayout />
          <Text>after the layout</Text>
        </ThemeProvider>,
      );

      expect(await screen.findByRole("radio", { name: /^Both/ })).toBeChecked();
    });
  });

  describe("when the read is paused because the phone is offline with nothing stored", () => {
    it("should still open the questions, with nothing answered, so the flow is never a blank screen", async () => {
      trainingGoalsRead.status = "paused";
      mockQuestion = "goal";

      await renderLayout();

      expect(
        await screen.findByRole("heading", { name: "What are you training for?" }),
      ).toBeOnTheScreen();
      expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    });
  });

  describe("while reads are off, as before the Terms are accepted", () => {
    it("should open the questions and make no read of the goal", async () => {
      trainingGoalsRead.isReadEnabled = false;
      trainingGoalsRead.row = storedGoalRow;
      mockQuestion = "goal";

      await renderLayout();

      expect(
        await screen.findByRole("heading", { name: "What are you training for?" }),
      ).toBeOnTheScreen();
      expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    });
  });

  describe("with no goal stored", () => {
    it("should open the questions with nothing answered", async () => {
      mockQuestion = "goal";

      await renderLayout();

      expect(
        await screen.findByRole("heading", { name: "What are you training for?" }),
      ).toBeOnTheScreen();
      for (const card of screen.getAllByRole("radio")) {
        expect(card).not.toBeChecked();
      }
    });
  });

  describe("when the goal cannot be read", () => {
    it("should still open the questions, with nothing answered", async () => {
      trainingGoalsRead.status = "error";
      mockQuestion = "goal";

      await renderLayout();

      expect(
        await screen.findByRole("heading", { name: "What are you training for?" }),
      ).toBeOnTheScreen();
      expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    });
  });

  describe("with a goal stored", () => {
    beforeEach(() => {
      trainingGoalsRead.row = storedGoalRow;
    });

    it("should show the goal's answer on the goal question", async () => {
      mockQuestion = "goal";
      await renderLayout();

      expect(await screen.findByRole("radio", { name: /^Both/ })).toBeChecked();
    });

    it("should show the goal's focuses on the focus question", async () => {
      mockQuestion = "focus";
      await renderLayout();

      expect(await screen.findByRole("checkbox", { name: /^Arms/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /^Chest/ })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /^Legs/ })).not.toBeChecked();
    });

    it("should show the goal's days on the days question", async () => {
      mockQuestion = "days";
      await renderLayout();

      expect(await screen.findByRole("radio", { name: "5" })).toBeChecked();
    });

    it("should show minutes that are no preset as Other, with the minutes in its field", async () => {
      mockQuestion = "minutes";
      await renderLayout();

      expect(await screen.findByRole("radio", { name: "Other" })).toBeChecked();
      expect(screen.getByLabelText("Other (min)")).toHaveDisplayValue("50");
    });

    it("should show the goal's equipment on the equipment question", async () => {
      mockQuestion = "equipment";
      await renderLayout();

      expect(await screen.findByRole("checkbox", { name: "Dumbbell" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Cable" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Other" })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: "Barbell" })).not.toBeChecked();
    });

    it("should show the goal's experience on the experience question", async () => {
      mockQuestion = "experience";
      await renderLayout();

      expect(await screen.findByRole("radio", { name: /^Advanced/ })).toBeChecked();
      expect(screen.getByRole("button", { name: "See your priorities" })).toBeEnabled();
    });
  });
});
