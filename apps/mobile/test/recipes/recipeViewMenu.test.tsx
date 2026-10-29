import { KeyLowProvider, keys } from "@keylow/api-client";
import { GENERIC_ERROR } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { chickenAndRiceRecipe } from "./recipeViewFixtures";
import {
  archivedSampleRecipes,
  sampleRecipes,
} from "../../components/RecipeLibraryView/sampleRecipes";
import { RecipeView } from "../../components/RecipeView";
import { ToastProvider } from "../../components/ui";
import { addToListPath, recipePath, recipesPath, refreshRecipePath } from "../../lib/recipeRoutes";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { recipeWritesClient } from "../support/recipeWritesBackend";

import type { RecipeViewRecipe } from "../../components/RecipeView";
import type { RecipeSummary } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The recipe view's More menu, with the real hooks over the diary's fake database: Duplicate and Archive,
// their toasts and Undo, and where each leads. The router is the mock, so a test reads where the view
// asked to go; the walk through the real router is in recipeViewMenuWalkThrough.test.tsx.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

const library: readonly RecipeSummary[] = [...archivedSampleRecipes, ...sampleRecipes];
const chickenSummary = sampleRecipes.find((recipe) => recipe.name === "Chicken and rice");
if (chickenSummary === undefined) {
  throw new Error("The sample library must hold Chicken and rice");
}
const chickenAndRice: RecipeViewRecipe = {
  ...chickenAndRiceRecipe,
  id: chickenSummary.id,
  is_archived: false,
};

let queryClient: QueryClient;

async function showView(recipe: RecipeViewRecipe = chickenAndRice) {
  queryClient = createDiaryQueryClient();
  // The screen around the view reads the library; here it is already read.
  queryClient.setQueryData(keys.recipes.list(true), [...library]);
  const user = userEvent.setup();
  // A new tree each time, since React skips an element it has already drawn.
  const treeOf = () => (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={recipeWritesClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeView recipe={recipe} onBack={jest.fn()} />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
  const rendered = await render(treeOf());
  // The real `usePathname` makes every screen render again when the address changes; here the test says so.
  const navigateTo = async (path: string) => {
    routerMock.pathname = path;
    await rendered.rerender(treeOf());
  };
  return { user, navigateTo };
}

const moreButton = () => screen.getByRole("button", { name: "More" });
const duplicateItem = () =>
  screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" });
const archiveItem = () =>
  screen.findByRole("button", { name: "Archive, Hidden until you restore it" });
const refreshItem = () =>
  screen.findByRole("button", { name: "Refresh ingredients, Check your foods for changes" });
const addToListItem = () =>
  screen.findByRole("button", {
    name: "Add to shopping list, Puts its ingredients on your list",
  });
const toast = (name: string) => screen.findByRole("status", { name });
const writesTo = (table: string) =>
  diaryBackend.requests.filter((request) => request.table === table && request.method !== "GET");
const storedRecipe = (name: string) => diaryBackend.recipes.find((row) => row["name"] === name);

describe("the recipe view's More menu", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeView",
      "components/RecipeViewMenu",
      "components/ServingsCard",
      "components/RecipeViewIngredientsSection",
      "components/RecipeViewStepsSection",
      "components/StepRow",
      "components/PerServingCard",
      "components/FoodDetail",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.recipes = library.map((recipe) => ({ ...recipe }));
    jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.restoreAllMocks();
  });

  describe("More", () => {
    it("should be the header's second control, after Edit", async () => {
      await showView();

      const [back, edit, more] = screen.getAllByRole("button");

      expect(back).toHaveAccessibleName("Back");
      expect(edit).toHaveAccessibleName("Edit Chicken and rice");
      expect(more).toHaveAccessibleName("More");
    });

    it("should open a sheet of Refresh ingredients, Duplicate and Archive, each with its caption", async () => {
      const { user } = await showView();

      await user.press(moreButton());

      expect(await refreshItem()).toBeEnabled();
      expect(await duplicateItem()).toBeEnabled();
      expect(await archiveItem()).toBeEnabled();
      expect(
        screen.getAllByRole("button", { name: /, (?:Check your foods|Makes|Hidden)/ }),
      ).toHaveLength(3);
    });

    it("should list Refresh ingredients first", async () => {
      const { user } = await showView();

      await user.press(moreButton());
      await refreshItem();

      const [first, second, third] = screen.getAllByRole("button", {
        name: /, (?:Check your foods|Makes|Hidden)/,
      });
      expect(first).toHaveAccessibleName(/^Refresh ingredients, /);
      expect(second).toHaveAccessibleName(/^Duplicate, /);
      expect(third).toHaveAccessibleName(/^Archive, /);
    });

    it("should leave Archive out for a recipe that is already archived, and keep Duplicate", async () => {
      const { user } = await showView({ ...chickenAndRice, is_archived: true });

      await user.press(moreButton());

      expect(await duplicateItem()).toBeEnabled();
      expect(screen.queryByRole("button", { name: /^Archive, / })).not.toBeOnTheScreen();
    });

    it("should be disabled while offline, and the sheet does not open", async () => {
      const { user } = await showView();
      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(moreButton()).toBeDisabled();
      await user.press(moreButton());

      expect(screen.queryByRole("button", { name: /^Duplicate, / })).not.toBeOnTheScreen();
    });
  });

  describe("going offline with the menu open", () => {
    it("should close the sheet, so nothing is chosen that would wait for the connection", async () => {
      const { user } = await showView();
      await user.press(moreButton());
      await duplicateItem();

      await act(() => {
        onlineManager.setOnline(false);
      });

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /^Duplicate, / })).not.toBeOnTheScreen();
      });
      expect(moreButton()).toBeDisabled();
    });
  });

  describe("Add to shopping list", () => {
    it("should come after Refresh ingredients and before Duplicate", async () => {
      const { user } = await showView();
      await user.press(moreButton());
      await addToListItem();

      const [first, second, third] = screen.getAllByRole("button", {
        name: /, (?:Check your foods|Puts its|Makes)/,
      });
      expect(first).toHaveAccessibleName(/^Refresh ingredients, /);
      expect(second).toHaveAccessibleName(/^Add to shopping list, /);
      expect(third).toHaveAccessibleName(/^Duplicate, /);
    });

    it("should push the add screen at the servings on screen, and write nothing", async () => {
      const { user } = await showView();
      await user.press(screen.getByRole("button", { name: "More servings" }));
      await user.press(moreButton());

      await user.press(await addToListItem());

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(
        addToListPath(chickenAndRice.id, chickenAndRice.servings + 1),
      );
      expect(writesTo("shopping_list_items")).toHaveLength(0);
    });
  });

  describe("Refresh ingredients", () => {
    it("should push the refresh screen over the view and close the sheet", async () => {
      const { user } = await showView();
      await user.press(moreButton());

      await user.press(await refreshItem());

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(refreshRecipePath(chickenAndRice.id));
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /^Refresh ingredients, / }),
        ).not.toBeOnTheScreen();
      });
    });

    it("should write nothing and read no food on the way, since the screen it opens does the looking", async () => {
      const { user } = await showView();
      await user.press(moreButton());

      await user.press(await refreshItem());

      expect(writesTo("recipes")).toHaveLength(0);
      expect(writesTo("save_recipe")).toHaveLength(0);
    });

    it("should push once for a double tap", async () => {
      const { user } = await showView();
      await user.press(moreButton());
      const item = await refreshItem();

      await act(async () => {
        await fireEvent.press(item);
        await fireEvent.press(item);
      });

      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });

    it("should open the screen again the next time, as the menu comes back from it", async () => {
      const { user } = await showView();
      await user.press(moreButton());
      await user.press(await refreshItem());

      await user.press(moreButton());
      await user.press(await refreshItem());

      expect(routerMock.push).toHaveBeenCalledTimes(2);
    });

    it("should be left in the menu of an archived recipe, which can still be refreshed", async () => {
      const { user } = await showView({ ...chickenAndRice, is_archived: true });

      await user.press(moreButton());

      expect(await refreshItem()).toBeEnabled();
    });
  });

  describe("Duplicate", () => {
    async function duplicate(user: Awaited<ReturnType<typeof showView>>["user"]) {
      await user.press(moreButton());
      await user.press(await duplicateItem());
    }

    it("should save a copy named (copy), open its view and say Recipe duplicated with Undo", async () => {
      const { user } = await showView();

      await duplicate(user);

      expect(await toast("Recipe duplicated")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      const copy = storedRecipe("Chicken and rice (copy)");
      expect(copy).toBeDefined();
      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(recipePath(String(copy?.["id"])));
    });

    it("should show its toast at the top under the safe area", async () => {
      jest.mocked(useSafeAreaInsets).mockReturnValue({ top: 47, right: 0, bottom: 20, left: 0 });
      const { user } = await showView();

      await duplicate(user);
      await toast("Recipe duplicated");

      // The toast's placement has no role or name to query, so it is read from its test id.
      expect(screen.getByTestId("toast")).toHaveStyle({ top: 47 + 12 });
    });

    it("should close the sheet and change nothing of the original", async () => {
      const { user } = await showView();

      await duplicate(user);
      await toast("Recipe duplicated");

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /^Duplicate, / })).not.toBeOnTheScreen();
      });
      expect(writesTo("recipes")).toHaveLength(0);
      expect(writesTo("save_recipe")).toHaveLength(1);
    });

    it("should name a second copy of the original (copy 2)", async () => {
      const { user } = await showView();
      await duplicate(user);
      await toast("Recipe duplicated");

      await duplicate(user);

      await waitFor(() => {
        expect(storedRecipe("Chicken and rice (copy 2)")).toBeDefined();
      });
      expect(routerMock.push).toHaveBeenCalledTimes(2);
    });

    it("should make one copy for a double tap on Duplicate", async () => {
      const { user } = await showView();
      await user.press(moreButton());
      const item = await duplicateItem();

      await act(async () => {
        await fireEvent.press(item);
        await fireEvent.press(item);
      });

      expect(await toast("Recipe duplicated")).toBeOnTheScreen();
      expect(writesTo("save_recipe")).toHaveLength(1);
      expect(routerMock.push).toHaveBeenCalledTimes(1);
    });

    it("should archive the copy with Undo and go back to the original's view", async () => {
      const { user, navigateTo } = await showView();
      await duplicate(user);
      await toast("Recipe duplicated");
      const copyId = String(storedRecipe("Chicken and rice (copy)")?.["id"]);
      // The copy's view is in front of this one.
      await navigateTo(recipePath(copyId));

      await user.press(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(storedRecipe("Chicken and rice (copy)")).toEqual(
          expect.objectContaining({ is_archived: true }),
        );
      });
      await waitFor(() => {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
      });
      expect(diaryBackend.requests.some((request) => request.method === "DELETE")).toBe(false);
    });

    it("should archive the copy with Undo but stay put when the user has left the copy's view", async () => {
      const { user, navigateTo } = await showView();
      await duplicate(user);
      await toast("Recipe duplicated");
      // The user went on to the copy's view and back to the original's own.
      await navigateTo(recipePath(chickenAndRice.id));

      await user.press(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(storedRecipe("Chicken and rice (copy)")).toEqual(
          expect.objectContaining({ is_archived: true }),
        );
      });
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should stay put and say one fixed sentence when the archive behind Undo fails", async () => {
      const { user, navigateTo } = await showView();
      await duplicate(user);
      await toast("Recipe duplicated");
      const copyId = String(storedRecipe("Chicken and rice (copy)")?.["id"]);
      await navigateTo(recipePath(copyId));
      diaryBackend.failingWriteTables.add("recipes");

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(await toast(GENERIC_ERROR)).toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
      expect(storedRecipe("Chicken and rice (copy)")).toEqual(
        expect.objectContaining({ is_archived: false }),
      );
    });

    it("should still say Recipe duplicated when opening the copy's view fails", async () => {
      routerMock.push.mockImplementation(() => {
        throw new Error("push failed");
      });
      const { user } = await showView();

      await duplicate(user);

      expect(await toast("Recipe duplicated")).toBeOnTheScreen();
    });

    it("should stay on the view and say one fixed sentence when the copy is not saved", async () => {
      diaryBackend.failingWriteTables.add("recipes");
      const { user } = await showView();

      await duplicate(user);

      expect(await toast(GENERIC_ERROR)).toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(screen.queryByText("Recipe duplicated")).not.toBeOnTheScreen();
      expect(routerMock.push).not.toHaveBeenCalled();
    });
  });

  describe("Archive", () => {
    async function archive(user: Awaited<ReturnType<typeof showView>>["user"]) {
      await user.press(moreButton());
      await user.press(await archiveItem());
    }

    it("should return to the library and say Recipe archived with Undo", async () => {
      const { user } = await showView();

      await archive(user);

      expect(await toast("Recipe archived")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
      expect(routerMock.dismissTo).toHaveBeenCalledWith(recipesPath());
    });

    it("should change nothing but the archived flag", async () => {
      const { user } = await showView();

      await archive(user);
      await toast("Recipe archived");

      expect(writesTo("recipes")).toHaveLength(1);
      expect(storedRecipe("Chicken and rice")).toEqual(
        expect.objectContaining({ is_archived: true }),
      );
    });

    it("should act once for a double tap on Archive", async () => {
      const { user } = await showView();
      await user.press(moreButton());
      const item = await archiveItem();

      await act(async () => {
        await fireEvent.press(item);
        await fireEvent.press(item);
      });

      expect(await toast("Recipe archived")).toBeOnTheScreen();
      expect(writesTo("recipes")).toHaveLength(1);
      expect(routerMock.dismissTo).toHaveBeenCalledTimes(1);
    });

    it("should bring the recipe back with Undo", async () => {
      const { user } = await showView();
      await archive(user);
      await toast("Recipe archived");

      await user.press(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(storedRecipe("Chicken and rice")).toEqual(
          expect.objectContaining({ is_archived: false }),
        );
      });
    });

    it("should stay on the view and say one fixed sentence when the write fails", async () => {
      diaryBackend.failingWriteTables.add("recipes");
      const { user } = await showView();

      await archive(user);

      expect(await toast(GENERIC_ERROR)).toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
      expect(screen.queryByText("Recipe archived")).not.toBeOnTheScreen();
      expect(routerMock.dismissTo).not.toHaveBeenCalled();
    });
  });
});
