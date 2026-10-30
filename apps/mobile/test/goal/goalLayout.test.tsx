import { render } from "@testing-library/react-native";

import GoalLayout from "../../app/goal/_layout";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The stack the layout draws, as a stand-in that keeps the options it was given.
const mockStackOptions: unknown[] = [];
jest.mock("expo-router", () => {
  const { mockExpoRouter } = jest.requireActual<{
    mockExpoRouter: { Stack: { Screen: unknown } };
  }>("../support/expoRouterMock");

  return {
    ...mockExpoRouter,
    Stack: Object.assign(({ screenOptions }: { screenOptions: unknown }) => {
      mockStackOptions.push(screenOptions);
      return null;
    }, mockExpoRouter.Stack),
  };
});

describe("the goal layout", () => {
  beforeEach(() => {
    resetRouterMock();
    mockStackOptions.length = 0;
  });

  it("should switch the iOS edge swipe off for the flow, so it cannot be left without the question", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <GoalLayout />
      </ThemeProvider>,
    );

    expect(routerMock.screenOptions).toContainEqual({ gestureEnabled: false });
  });

  it("should draw its stack with no header and the edge swipe off for each question", async () => {
    await render(
      <ThemeProvider fixedPreference="dark">
        <GoalLayout />
      </ThemeProvider>,
    );

    expect(mockStackOptions).toContainEqual(
      expect.objectContaining({ headerShown: false, gestureEnabled: false }),
    );
  });
});
