import "react-native-gesture-handler/jestSetup";
import { onlineManager } from "@tanstack/react-query";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  foodFixture,
  mockToggleFavouriteFood,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import PortionPickerRoute from "../../app/foods/[id]/log";
import { ToastProvider, sheetHeaderHeight } from "../../components/ui";
import { PlateProvider } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

// The favourite heart in the portion picker's header, which a food opened from the log search, Recent or the
// Favourites strip lands on. The heart's own behaviour is pinned in detailFavourite.test.tsx.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "@keylow/api-client",
  () => jest.requireActual<{ mockApiClient: unknown }>("./support/apiClientMock").mockApiClient,
);

setUpTests();

async function renderPicker(params: Record<string, string>) {
  routerMock.searchParams = { id: savedFoodId, ...params };
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PlateProvider>
          <PortionPickerRoute />
        </PlateProvider>
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

const addHeart = () => screen.getByRole("button", { name: "Add to favourites" });

describe("the favourite heart on the portion picker header", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetApiClientMock();
    onlineManager.setOnline(true);
  });

  it.each([
    ["while logging to the plate", { day: "2026-10-15", time: "18:00" }],
    ["when it logs straight to the diary", {}],
  ])("should be in the header %s", async (_situation, params) => {
    await renderPicker(params);

    expect(addHeart()).toBeOnTheScreen();
  });

  it("should favourite the food on a tap and say so in a toast under the header", async () => {
    const user = await renderPicker({ day: "2026-10-15", time: "18:00" });

    await user.press(addHeart());

    expect(mockToggleFavouriteFood).toHaveBeenCalledTimes(1);
    expect(mockToggleFavouriteFood.mock.calls[0]?.[0]).toEqual({
      food: foodFixture,
      favourite: true,
    });
    expect(await screen.findByRole("status", { name: "Added to favourites" })).toBeOnTheScreen();
    expect(screen.getByTestId("toast")).toHaveStyle({ top: sheetHeaderHeight.sheet });
  });

  it("should be disabled while the phone is offline", async () => {
    await renderPicker({ day: "2026-10-15", time: "18:00" });

    await act(() => {
      onlineManager.setOnline(false);
    });

    expect(addHeart()).toBeDisabled();
  });
});
