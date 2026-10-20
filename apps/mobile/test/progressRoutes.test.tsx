import { existsSync } from "node:fs";
import { join } from "node:path";

import { render, screen, userEvent } from "@testing-library/react-native";

import ExerciseProgressRoute from "../app/(tabs)/train/progress/[exerciseId]";
import { exerciseProgressPath, progressBackPath } from "../lib/progressRoutes";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
// The screen is stood in for by its two props, so what is tested is the route: the id it reads from the
// address and where Back goes.
jest.mock("../components/ExerciseProgressScreen", () => ({
  ExerciseProgressScreen: ({
    exerciseId,
    onBack,
  }: {
    exerciseId: string | undefined;
    onBack: () => void;
  }) => {
    const { Pressable: Button, Text: Words } =
      jest.requireActual<typeof import("react-native")>("react-native");
    const { createElement } = jest.requireActual<typeof import("react")>("react");
    return createElement(
      Button,
      { role: "button", "aria-label": "Back", onPress: onBack },
      createElement(Words, null, `Exercise ${exerciseId ?? "none"}`),
    );
  },
}));

const EXERCISE_ID = "77777777-7777-4777-8777-777777777777";

describe("the exercise progress address and the screen under app/", () => {
  beforeEach(() => {
    resetRouterMock();
    routerMock.searchParams = { exerciseId: EXERCISE_ID };
  });

  it("should address the graph inside the Train tab by the exercise's id alone", () => {
    expect(exerciseProgressPath(EXERCISE_ID)).toBe(`/train/progress/${EXERCISE_ID}`);
  });

  it("should have a route file for the graph", () => {
    expect(existsSync(join(__dirname, "..", "app", "(tabs)/train/progress/[exerciseId].tsx"))).toBe(
      true,
    );
  });

  it("should hand the screen the id from the address", async () => {
    await render(<ExerciseProgressRoute />);

    expect(screen.getByText(`Exercise ${EXERCISE_ID}`)).toBeOnTheScreen();
  });

  it("should go back to the screen before it", async () => {
    const user = userEvent.setup();
    await render(<ExerciseProgressRoute />);

    await user.press(screen.getByRole("button", { name: "Back" }));

    expect(routerMock.back).toHaveBeenCalledTimes(1);
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("should go to the routines when a cold link has nothing before it", async () => {
    routerMock.canGoBack.mockReturnValue(false);
    const user = userEvent.setup();
    await render(<ExerciseProgressRoute />);

    await user.press(screen.getByRole("button", { name: "Back" }));

    expect(routerMock.replace).toHaveBeenCalledWith(progressBackPath());
    expect(progressBackPath()).toBe("/train/routines");
    expect(routerMock.back).not.toHaveBeenCalled();
  });
});
