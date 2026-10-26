import "react-native-gesture-handler/jestSetup";

import { keys } from "@keylow/api-client";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import {
  mockLogRecipe,
  mockUseRecipe,
  recipeState,
  resetApiClientMock,
  termsAccepted,
} from "./support/apiClientMock";
import { goldenRecipeDetail, goldenRecipeId } from "./support/recipeFixtures";
import RecipeAmountRoute from "../../app/foods/recipe/[id]/log";
import { ToastProvider } from "../../components/ui";
import { PlateProvider, usePlate, usePlateLoggingGuard } from "../../lib/plate";
import { ThemeProvider } from "../../lib/theme";
import { trackFieldSelection } from "../support/amountFieldSelection";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { PlateContextValue, PlateLoggingGuard } from "../../lib/plate";

// The amount step of a recipe on its route, with the data hooks and the router mocked: what the boards draw,
// what Add to plate puts on the plate and where it leads. The picker's own figures are pinned in portionPickerRecipe.test.tsx.

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

const openedAt = new Date("2026-10-15T11:40:30Z");

type Params = { id?: string; day?: string; time?: string | undefined };

// The plate the picker puts the recipe on, read from inside the provider the food sheet's layout mounts.
let plate: PlateContextValue;
let loggingGuard: PlateLoggingGuard;

function PlateReader() {
  const current = usePlate();
  const guard = usePlateLoggingGuard();
  useEffect(() => {
    plate = current;
    loggingGuard = guard;
  });
  return null;
}

let queryClient: QueryClient;
let invalidateQueries: jest.SpyInstance;

async function renderStep(params: Params = {}) {
  const searchParams: Params = { id: goldenRecipeId, day: "2026-10-15", time: "18:00", ...params };
  const { id, day, time } = searchParams;
  // A parameter left undefined is not in the address at all.
  routerMock.searchParams = {
    ...(id === undefined ? {} : { id }),
    ...(day === undefined ? {} : { day }),
    ...(time === undefined ? {} : { time }),
  };
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  queryClient = new QueryClient();
  invalidateQueries = jest.spyOn(queryClient, "invalidateQueries");
  await render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider fixedPreference="dark">
        <ToastProvider>
          <PlateProvider>
            <PlateReader />
            <RecipeAmountRoute />
          </PlateProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return user;
}

// Pressing a unit chip selects the amount, which the jest preset's text field cannot do.
trackFieldSelection();

describe("the amount step of a recipe", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: openedAt });
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetApiClientMock();
    onlineManager.setOnline(true);
    recipeState.current = { status: "ready", recipe: goldenRecipeDetail() };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    onlineManager.setOnline(true);
  });

  describe("loading the recipe", () => {
    it("should ask for the recipe by the id in the route", async () => {
      await renderStep();

      expect(mockUseRecipe).toHaveBeenCalledWith(goldenRecipeId, { enabled: true });
    });

    it("should show the loading state while the recipe loads", async () => {
      recipeState.current = { status: "loading" };
      await renderStep();

      expect(screen.getByRole("status", { name: "Loading recipe" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
    });

    it("should say the recipe was not found for an id that cannot be a recipe, without asking for it", async () => {
      await renderStep({ id: "chicken-and-rice" });

      expect(screen.getByText("Recipe not found")).toBeOnTheScreen();
      expect(mockUseRecipe).toHaveBeenCalledWith(undefined, expect.anything());
    });

    it("should say the recipe was not found when it is not the user's", async () => {
      recipeState.current = { status: "notFound" };
      await renderStep();

      expect(screen.getByText("Recipe not found")).toBeOnTheScreen();
    });

    it("should say the recipe was not found when it is archived, because the search never offers one", async () => {
      recipeState.current = {
        status: "ready",
        recipe: { ...goldenRecipeDetail(), is_archived: true },
      };
      await renderStep();

      expect(screen.getByText("Recipe not found")).toBeOnTheScreen();
    });

    it("should say the recipe was not found when it has no weight, because nothing of it can be logged", async () => {
      const recipe = goldenRecipeDetail();
      recipeState.current = {
        status: "ready",
        recipe: { ...recipe, computed: { ...recipe.computed, effectiveGrams: 0 } },
      };
      await renderStep();

      expect(screen.getByText("Recipe not found")).toBeOnTheScreen();
    });

    it.each([
      ["energy", { kcal: null }],
      ["protein", { protein_g: null }],
      ["carbohydrate", { carbs_g: null }],
      ["fat", { fat_g: null }],
    ])(
      "should say the recipe was not found when it is missing its %s, as the search leaves it out",
      async (_name, missing) => {
        const recipe = goldenRecipeDetail();
        recipeState.current = {
          status: "ready",
          recipe: {
            ...recipe,
            computed: {
              ...recipe.computed,
              perServing: { ...recipe.computed.perServing, ...missing },
            },
          },
        };
        await renderStep();

        expect(screen.getByText("Recipe not found")).toBeOnTheScreen();
        expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
      },
    );

    it("should say it could not load, in a fixed sentence, when the read failed", async () => {
      recipeState.current = { status: "error", debugMessage: "Could not load the recipe (500)" };
      await renderStep();

      expect(screen.getByText("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(screen.queryByText(/500/)).not.toBeOnTheScreen();
    });

    it("should read the recipe again on Try again when the recipe failed to load", async () => {
      recipeState.current = { status: "error", debugMessage: "Could not load the recipe (500)" };
      const user = await renderStep();

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: keys.recipes.detail(goldenRecipeId),
      });
      expect(invalidateQueries).not.toHaveBeenCalledWith({
        queryKey: keys.profiles.timeZone,
      });
    });

    it("should read nothing while the Terms are not accepted", async () => {
      termsAccepted.current = false;
      await renderStep();

      expect(mockUseRecipe.mock.calls.every(([, options]) => options?.enabled === false)).toBe(
        true,
      );
    });

    it("should go back one screen from the loading state", async () => {
      recipeState.current = { status: "loading" };
      const user = await renderStep();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
  });

  describe("the step", () => {
    it("should open on one serving of the recipe, with no Time row, because the time is the plate's", async () => {
      await renderStep();

      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Energy and macros, For 1 serving (275 g)")).toBeOnTheScreen();
      expect(screen.getByLabelText("Amount (serving)")).toHaveDisplayValue("1");
      expect(screen.queryByRole("button", { name: /^Time/ })).not.toBeOnTheScreen();
    });

    it("should go back one screen with Back", async () => {
      const user = await renderStep();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
  });

  describe("Add to plate", () => {
    const addToPlateButton = () => screen.getByRole("button", { name: "Add to plate" });

    it("should have Add to plate in place of Add", async () => {
      await renderStep();

      expect(addToPlateButton()).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Add" })).not.toBeOnTheScreen();
    });

    it("should put one serving on the plate and write nothing", async () => {
      const user = await renderStep();

      await user.press(addToPlateButton());

      expect(plate.items).toHaveLength(1);
      const [item] = plate.items;
      expect(item).toMatchObject({ kind: "recipe", quantity: 1, unit: "serving" });
      expect(item?.kind === "recipe" ? item.recipe.id : undefined).toBe(goldenRecipeId);
      expect(mockLogRecipe).not.toHaveBeenCalled();
      expect(screen.queryByText("Added")).not.toBeOnTheScreen();
      expect(routerMock.parentGoBack).not.toHaveBeenCalled();
    });

    it("should dim Add to plate while the plate is being logged, and put nothing more on it", async () => {
      const user = await renderStep();

      await act(() => {
        loggingGuard.startLogging();
      });

      expect(addToPlateButton()).toBeDisabled();
      await user.press(addToPlateButton());
      expect(plate.items).toHaveLength(0);
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });

    it("should put the grams that were chosen on the plate", async () => {
      const user = await renderStep();
      await user.press(screen.getByRole("radio", { name: "g" }));
      await fireEvent.changeText(screen.getByLabelText("Amount (g)"), "300");

      await user.press(addToPlateButton());

      expect(plate.items[0]).toMatchObject({ quantity: 300, unit: "g" });
    });

    it("should return to the search on the day it was opened for, and keep the hour of an hour's plus", async () => {
      const user = await renderStep();

      await user.press(addToPlateButton());

      expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      expect(routerMock.dismissTo).toHaveBeenCalledWith("/foods?day=2026-10-15&time=18%3A00");
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should return to the search on the day alone from the dock", async () => {
      const user = await renderStep({ time: undefined });

      await user.press(addToPlateButton());

      expect(routerMock.dismissTo).toHaveBeenCalledWith("/foods?day=2026-10-15");
    });

    it("should tell a screen reader the recipe is on the plate", async () => {
      const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility");
      const user = await renderStep();

      await user.press(addToPlateButton());

      expect(announce).toHaveBeenCalledWith("Chicken and rice added to your plate");
    });

    it("should work with the connection lost, because nothing is written", async () => {
      onlineManager.setOnline(false);
      const user = await renderStep();

      expect(addToPlateButton()).toBeEnabled();
      await user.press(addToPlateButton());

      expect(plate.items).toHaveLength(1);
      expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      await act(() => {
        onlineManager.setOnline(true);
      });
    });

    it("should put one serving on the plate once however often it is pressed before the screen has gone", async () => {
      await renderStep();
      const button = addToPlateButton();

      await act(async () => {
        await fireEvent.press(button);
        await fireEvent.press(button);
      });

      expect(plate.items).toHaveLength(1);
      expect(plate.items[0]).toMatchObject({ quantity: 1 });
      expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
    });
  });
});
