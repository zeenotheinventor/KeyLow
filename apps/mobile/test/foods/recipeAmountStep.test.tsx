import "react-native-gesture-handler/jestSetup";

import { keys } from "@keylow/api-client";
import { buildRecipeLogEntry } from "@keylow/core/diary";
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import {
  mockLogRecipe,
  mockUseRecipe,
  profileTimeZone,
  recipeState,
  resetApiClientMock,
  termsAccepted,
} from "./support/apiClientMock";
import { goldenRecipe, goldenRecipeDetail, goldenRecipeId } from "./support/recipeFixtures";
import RecipeAmountRoute from "../../app/foods/recipe/[id]/log";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { trackFieldSelection } from "../support/amountFieldSelection";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { RecipeLogEntry } from "@keylow/api-client";

// The amount step of a recipe on its route, with the data hooks and the router mocked: what the boards draw,
// what Add logs and where it leads. The picker's own figures are pinned in portionPickerRecipe.test.tsx.

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
          <RecipeAmountRoute />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return user;
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

const addButton = () => screen.getByRole("button", { name: "Add" });

function storedEntry(): RecipeLogEntry {
  return {
    ...buildRecipeLogEntry({
      recipe: goldenRecipe(),
      quantity: 1,
      unit: "serving",
      loggedAt: "2026-10-15T17:00:00.000Z",
      localDate: "2026-10-15",
    }),
    id: "entry-recipe",
    created_at: "2026-10-15T11:40:31.000Z",
    kcal: 374.2,
  };
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
    mockLogRecipe.mockResolvedValue(storedEntry());
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

    it("should wait for the profile's time zone, because the time is read in it", async () => {
      profileTimeZone.current = { data: undefined, isPending: true, isError: false };
      await renderStep();

      expect(screen.getByRole("status", { name: "Loading recipe" })).toBeOnTheScreen();
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

    it("should read the time zone again on Try again when that is what failed", async () => {
      profileTimeZone.current = { data: undefined, isPending: false, isError: true };
      const user = await renderStep();

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: keys.profiles.timeZone,
      });
    });

    it("should say it could not load when the time zone could not be read", async () => {
      profileTimeZone.current = { data: undefined, isPending: false, isError: true };
      await renderStep();

      expect(screen.getByText("Something went wrong. Try again.")).toBeOnTheScreen();
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
    it("should open on one serving of the recipe at the hour it was opened from", async () => {
      await renderStep();

      expect(screen.getByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(screen.getByLabelText("Energy and macros, For 1 serving (275 g)")).toBeOnTheScreen();
      expect(screen.getByLabelText("Amount (serving)")).toHaveDisplayValue("1");
      expect(screen.getByRole("button", { name: "Time, 18:00, change" })).toBeOnTheScreen();
    });

    it("should read the time as now, in the profile's zone, when opened from the dock", async () => {
      await renderStep({ time: undefined });

      expect(screen.getByRole("button", { name: "Time, now, 12:40, change" })).toBeOnTheScreen();
    });

    it("should go back one screen with Back", async () => {
      const user = await renderStep();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });
  });

  describe("Add", () => {
    it("should log one serving at the hour it was opened from, with the recipe as it was read", async () => {
      const user = await renderStep();

      await user.press(addButton());

      expect(mockLogRecipe).toHaveBeenCalledTimes(1);
      expect(mockLogRecipe).toHaveBeenCalledWith({
        recipe: goldenRecipeDetail(),
        quantity: 1,
        unit: "serving",
        loggedAt: "2026-10-15T17:00:00.000Z",
        localDate: "2026-10-15",
      });
    });

    it("should log at the moment the screen opened when the time still reads now", async () => {
      const user = await renderStep({ time: undefined });

      await user.press(addButton());

      expect(mockLogRecipe).toHaveBeenCalledWith(
        expect.objectContaining({ loggedAt: "2026-10-15T11:40:30.000Z" }),
      );
    });

    it("should log at the time chosen in the time picker, not the time the screen opened with", async () => {
      const user = await renderStep({ time: undefined });
      await user.press(screen.getByRole("button", { name: "Time, now, 12:40, change" }));
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Hours" })).getByRole("option", {
          name: "17",
        }),
      );
      await user.press(
        within(screen.getByRole("spinbutton", { name: "Minutes" })).getByRole("option", {
          name: "25",
        }),
      );
      await user.press(screen.getByRole("button", { name: "Done" }));
      await advance(1000);

      await user.press(addButton());

      expect(mockLogRecipe).toHaveBeenCalledWith(
        expect.objectContaining({
          loggedAt: "2026-10-15T16:25:00.000Z",
          localDate: "2026-10-15",
        }),
      );
    });

    it("should log the grams that were chosen", async () => {
      const user = await renderStep();
      await user.press(screen.getByRole("radio", { name: "g" }));
      await fireEvent.changeText(screen.getByLabelText("Amount (g)"), "300");

      await user.press(addButton());

      expect(mockLogRecipe).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 300, unit: "g" }),
      );
    });

    it("should close the sheet to the diary and show the Added toast when it has saved", async () => {
      const user = await renderStep();

      await user.press(addButton());

      expect(screen.getByText("Added")).toBeOnTheScreen();
      expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
    });

    it("should be inert while the connection is lost", async () => {
      onlineManager.setOnline(false);
      const user = await renderStep();

      expect(addButton()).toBeDisabled();
      await user.press(addButton());
      expect(mockLogRecipe).not.toHaveBeenCalled();
      // The connection comes back while the screen is still up, which redraws it.
      await act(() => {
        onlineManager.setOnline(true);
      });
    });

    describe("while it saves", () => {
      let finishSaving: () => void;

      beforeEach(() => {
        mockLogRecipe.mockReturnValue(
          new Promise((resolve) => {
            finishSaving = () => {
              resolve(storedEntry());
            };
          }),
        );
      });

      it("should show Add as working and log only once however often it is pressed", async () => {
        const user = await renderStep();

        await user.press(addButton());
        await user.press(screen.getByRole("button", { name: /Add/, busy: true }));

        expect(screen.getByRole("button", { name: /Add/, busy: true })).toBeOnTheScreen();
        expect(mockLogRecipe).toHaveBeenCalledTimes(1);
      });

      it("should log once when two presses land before the screen has redrawn", async () => {
        await renderStep();
        const button = addButton();

        await act(async () => {
          await fireEvent.press(button);
          await fireEvent.press(button);
        });

        expect(mockLogRecipe).toHaveBeenCalledTimes(1);
      });

      it("should close the sheet when it has saved", async () => {
        const user = await renderStep();
        await user.press(addButton());

        await act(() => {
          finishSaving();
        });

        expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      });
    });

    describe("when it cannot save", () => {
      beforeEach(() => {
        mockLogRecipe.mockRejectedValue(new Error("network down while logging 300 g of a recipe"));
      });

      it("should say it was not saved in the fixed sentence, keep the sheet open and let Add be pressed again", async () => {
        const user = await renderStep();

        await user.press(addButton());

        expect(
          screen.getByRole("alert", { name: /Not saved\. Check your connection and try again\./ }),
        ).toBeOnTheScreen();
        expect(screen.queryByText(/network down/)).not.toBeOnTheScreen();
        expect(screen.queryByText("Added")).not.toBeOnTheScreen();
        expect(routerMock.parentGoBack).not.toHaveBeenCalled();
        expect(addButton()).toBeEnabled();
      });

      it("should clear the notice when Add is pressed again and saves", async () => {
        const user = await renderStep();
        await user.press(addButton());
        mockLogRecipe.mockResolvedValue(storedEntry());

        await user.press(addButton());

        expect(screen.queryByRole("alert", { name: /Not saved/ })).not.toBeOnTheScreen();
        expect(routerMock.parentGoBack).toHaveBeenCalledTimes(1);
      });
    });
  });
});
