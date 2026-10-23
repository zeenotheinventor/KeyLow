import { renderHook } from "@testing-library/react-native";

import { useOpenSession } from "../../lib/useOpenSession";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);

describe("opening the session screen", () => {
  let now = 0;

  beforeEach(() => {
    resetRouterMock();
    now = 1_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should push the session screen", async () => {
    const { result } = await renderHook(() => useOpenSession());

    result.current();

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith("/session");
  });

  it("should treat a second press within a second as the same press", async () => {
    const { result } = await renderHook(() => useOpenSession());

    result.current();
    now += 999;
    result.current();

    expect(routerMock.push).toHaveBeenCalledTimes(1);
  });

  it("should open again once a second has passed", async () => {
    const { result } = await renderHook(() => useOpenSession());

    result.current();
    now += 1000;
    result.current();

    expect(routerMock.push).toHaveBeenCalledTimes(2);
  });
});
