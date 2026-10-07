import { render, screen, userEvent } from "@testing-library/react-native";

import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import DiaryRoute from "../app/(tabs)/diary";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);

describe("diary route", () => {
  beforeEach(resetRouterMock);

  it("should keep the diary heading", async () => {
    await render(<DiaryRoute />);

    expect(screen.getByRole("header", { name: "Diary" })).toBeOnTheScreen();
  });

  it("should open the food search from the Find food button", async () => {
    const user = userEvent.setup();
    await render(<DiaryRoute />);

    await user.press(screen.getByRole("button", { name: "Find food" }));

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith("/foods");
  });
});
