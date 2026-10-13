import { render, screen } from "@testing-library/react-native";

import StorybookRoute from "../app/storybook";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
// The real entry needs the generated story index, which Metro writes.
jest.mock("../.rnstorybook", () => {
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");

  return { __esModule: true, default: () => <Text>Storybook UI</Text> };
});

describe("the Storybook route", () => {
  beforeEach(() => {
    resetRouterMock();
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_STORYBOOK;
  });

  it("should show Storybook when the Storybook flag is on", async () => {
    process.env.EXPO_PUBLIC_STORYBOOK = "true";

    await render(<StorybookRoute />);

    expect(screen.getByText("Storybook UI")).toBeOnTheScreen();
    expect(routerMock.redirect).not.toHaveBeenCalled();
  });

  it("should redirect to the home route when the Storybook flag is not set", async () => {
    await render(<StorybookRoute />);

    expect(routerMock.redirect).toHaveBeenCalledWith("/");
    expect(screen.queryByText("Storybook UI")).not.toBeOnTheScreen();
  });

  it("should redirect to the home route when the Storybook flag is false", async () => {
    process.env.EXPO_PUBLIC_STORYBOOK = "false";

    await render(<StorybookRoute />);

    expect(routerMock.redirect).toHaveBeenCalledWith("/");
  });
});
