import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react-native";

import GoalLayout from "../../app/goal/_layout";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { programClient } from "../support/programBackend";

import type { GoalQuestionScreen } from "../../components/GoalQuestionnaire";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
// The stack the layout draws, as a stand-in that draws the first question inside the flow's provider.
jest.mock("expo-router", () => {
  const { mockExpoRouter } = jest.requireActual<{
    mockExpoRouter: { Stack: { Screen: unknown } };
  }>("../support/expoRouterMock");
  const { createElement } = jest.requireActual<typeof import("react")>("react");

  return {
    ...mockExpoRouter,
    Stack: Object.assign(
      () =>
        createElement(
          jest.requireActual<{ GoalQuestionScreen: typeof GoalQuestionScreen }>(
            "../../components/GoalQuestionnaire",
          ).GoalQuestionScreen,
          { step: "goal" },
        ),
      mockExpoRouter.Stack,
    ),
  };
});

// A real query client, as the app has, whose default is to pause a request while the phone is offline. A
// stand-in that is only "pending" cannot show that pause, which left the flow a blank screen with no way out.
describe("the goal layout with no connection and nothing stored", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    onlineManager.setOnline(false);
  });

  afterEach(async () => {
    await cleanup();
    onlineManager.setOnline(true);
  });

  it("should open the first question, with nothing answered, instead of waiting for ever", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={programClient} queryClient={new QueryClient()}>
          <GoalLayout />
        </KeyLowProvider>
      </ThemeProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "What are you training for?" }),
    ).toBeOnTheScreen();
    expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
  });
});
