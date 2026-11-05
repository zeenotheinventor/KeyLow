import { keys, KeyLowProvider } from "@keylow/api-client";
import { GOAL_SCREEN } from "@keylow/core/copy";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react-native";

import GoalLayout from "../../app/goal/_layout";
import { goalQuestionPath } from "../../lib/goalRoutes";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { programClient } from "../support/programBackend";
import { storedGoalRow } from "../support/trainingGoalsRead";

import type GoalIndex from "../../app/goal";

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
// The stack the layout draws, as a stand-in that draws the flow's address inside the flow's provider.
jest.mock("expo-router", () => {
  const { mockExpoRouter } = jest.requireActual<{
    mockExpoRouter: { Stack: { Screen: unknown } };
  }>("../support/expoRouterMock");
  const { createElement } = jest.requireActual<typeof import("react")>("react");

  return {
    ...mockExpoRouter,
    Stack: Object.assign(
      () =>
        createElement(jest.requireActual<{ default: typeof GoalIndex }>("../../app/goal").default),
      mockExpoRouter.Stack,
    ),
  };
});

// A real query client, as the app has, which pauses a request while the phone is offline: a stand-in that is
// only "pending" cannot show that pause, which left the flow a blank screen with no way out.
describe("the Goal address with no connection", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/GoalQuestionnaire"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    onlineManager.setOnline(false);
  });

  const queryClients: QueryClient[] = [];

  afterEach(async () => {
    await cleanup();
    // A cached query holds a timer that would keep the test run open.
    queryClients.splice(0).forEach((queryClient) => {
      queryClient.clear();
    });
    onlineManager.setOnline(true);
  });

  const renderGoal = (queryClient: QueryClient) => {
    queryClients.push(queryClient);
    return render(
      <ThemeProvider fixedPreference="dark">
        <KeyLowProvider client={programClient} queryClient={queryClient}>
          <GoalLayout />
        </KeyLowProvider>
      </ThemeProvider>,
    );
  };

  it("should send the person to the first question, not wait for ever, when nothing is cached", async () => {
    await renderGoal(new QueryClient());

    expect(routerMock.redirect).toHaveBeenCalledWith(goalQuestionPath(1));
    expect(screen.queryByRole("status", { name: GOAL_SCREEN.loadingName })).not.toBeOnTheScreen();
  });

  it("should draw the stored answers from the cache", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(keys.training.goals, storedGoalRow);

    await renderGoal(queryClient);

    expect(await screen.findByRole("heading", { name: GOAL_SCREEN.title })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Days a week: 5. Change" })).toBeEnabled();
    expect(routerMock.redirect).not.toHaveBeenCalled();
  });
});
