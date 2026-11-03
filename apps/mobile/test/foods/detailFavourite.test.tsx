import { FavouriteRuleError } from "@keylow/api-client";
import { GENERIC_ERROR } from "@keylow/core/copy";
import { themes } from "@keylow/tokens";
import { onlineManager } from "@tanstack/react-query";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  favouriteFoods,
  foodFixture,
  mockToggleFavouriteFood,
  mockUseFavouriteFoods,
  resetApiClientMock,
  savedFoodId,
} from "./support/apiClientMock";
import FoodDetailRoute from "../../app/foods/[id]/index";
import { ToastProvider, sheetHeaderHeight } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { FavouriteFood } from "@keylow/api-client";

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

const savedFavourite: FavouriteFood = {
  foodId: savedFoodId,
  createdAt: "2026-11-03T09:00:00+00:00",
  food: foodFixture,
};

async function renderDetail() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <FoodDetailRoute />
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

// An icon in a button is decoration and has no role to query by, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const addHeart = () => screen.getByRole("button", { name: "Add to favourites" });
const removeHeart = () => screen.getByRole("button", { name: "Remove from favourites" });

describe("the favourite heart on the food detail header", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetApiClientMock();
    routerMock.searchParams = { id: savedFoodId };
    onlineManager.setOnline(true);
  });

  it("should sit between the title and Close, as an outline named Add to favourites", async () => {
    await renderDetail();

    const buttons = screen.getAllByRole("button");
    ["Back", "Add to favourites", "Close"].forEach((name, index) => {
      expect(buttons[index]).toHaveAccessibleName(name);
    });
    expect(drawings()[1]).toHaveProp("fill", "none");
  });

  it("should be filled and named Remove from favourites when the food is a favourite", async () => {
    favouriteFoods.current = { data: [savedFavourite], isPending: false, isError: false };

    await renderDetail();

    expect(removeHeart()).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Add to favourites" })).not.toBeOnTheScreen();
    expect(drawings()[1]).toHaveProp("fill", themes.dark.accent);
  });

  it("should read the favourites once the account may be read", async () => {
    await renderDetail();

    expect(mockUseFavouriteFoods).toHaveBeenCalledWith({ enabled: true });
  });

  it("should favourite the food at once on a tap and say so in a toast under the header", async () => {
    const user = await renderDetail();

    await user.press(addHeart());

    expect(mockToggleFavouriteFood).toHaveBeenCalledTimes(1);
    expect(mockToggleFavouriteFood.mock.calls[0]?.[0]).toEqual({
      food: foodFixture,
      favourite: true,
    });
    expect(await screen.findByRole("status", { name: "Added to favourites" })).toBeOnTheScreen();
  });

  it("should sit its toast just under the stack header, so the heart stays in view", async () => {
    const user = await renderDetail();

    await user.press(addHeart());

    await screen.findByRole("status", { name: "Added to favourites" });
    expect(screen.getByTestId("toast")).toHaveStyle({ top: sheetHeaderHeight.stack });
  });

  it("should unfavourite the food on a tap when it is a favourite, with its own toast", async () => {
    favouriteFoods.current = { data: [savedFavourite], isPending: false, isError: false };
    const user = await renderDetail();

    await user.press(removeHeart());

    expect(mockToggleFavouriteFood.mock.calls[0]?.[0]).toEqual({
      food: foodFixture,
      favourite: false,
    });
    expect(
      await screen.findByRole("status", { name: "Removed from favourites" }),
    ).toBeOnTheScreen();
  });

  it("should say you can have up to 30 favourites when the limit refuses one", async () => {
    mockToggleFavouriteFood.mockRejectedValue(
      new FavouriteRuleError("favourite the food", "favourite_limit"),
    );
    const user = await renderDetail();

    await user.press(addHeart());

    expect(
      await screen.findByRole("status", {
        name: "You can have up to 30 favourites. Remove one to add another.",
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole("status", { name: "Added to favourites" })).not.toBeOnTheScreen();
  });

  it("should show the generic error, and leave the heart as the list says, when the write fails", async () => {
    mockToggleFavouriteFood.mockRejectedValue(new Error("Could not favourite the food (500)"));
    const user = await renderDetail();

    await user.press(addHeart());

    expect(await screen.findByRole("status", { name: GENERIC_ERROR })).toBeOnTheScreen();
    expect(addHeart()).toBeOnTheScreen();
  });

  it("should be disabled while the phone is offline", async () => {
    await renderDetail();

    await act(() => {
      onlineManager.setOnline(false);
    });

    expect(addHeart()).toBeDisabled();
  });

  it("should be disabled until the favourites have been read, so it never guesses the state", async () => {
    favouriteFoods.current = { data: undefined, isPending: true, isError: false };

    await renderDetail();

    expect(addHeart()).toBeDisabled();
  });
});
