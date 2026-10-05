import { render } from "@testing-library/react-native";

import IndexRoute from "../app/index";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);

describe("index route", () => {
  beforeEach(resetRouterMock);

  it("should redirect to the diary tab", async () => {
    await render(<IndexRoute />);

    expect(routerMock.redirect).toHaveBeenCalledWith("/(tabs)/diary");
  });
});
