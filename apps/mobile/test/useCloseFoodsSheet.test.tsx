import { renderHook } from "@testing-library/react-native";

import { useCloseFoodsSheet } from "../lib/navigation";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";

jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);

describe("useCloseFoodsSheet", () => {
  beforeEach(() => {
    resetRouterMock();
  });

  it("should dismiss the whole sheet by going back in the navigator above the screen's own", async () => {
    const { result } = await renderHook(() => useCloseFoodsSheet());

    result.current();

    expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
  });

  it("should not go back within the sheet, which would only return to the screen before", async () => {
    const { result } = await renderHook(() => useCloseFoodsSheet());

    result.current();

    expect(routerMock.back).not.toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  describe("when the sheet is the only screen there is, as after a cold link to it", () => {
    it("should go to the dashboard when the navigator above has nothing to go back to", async () => {
      routerMock.parentCanGoBack.mockReturnValue(false);
      const { result } = await renderHook(() => useCloseFoodsSheet());

      result.current();

      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });

    it("should go to the dashboard when there is no navigator above at all", async () => {
      routerMock.hasParentNavigator = false;
      const { result } = await renderHook(() => useCloseFoodsSheet());

      result.current();

      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/dashboard");
    });
  });
});
