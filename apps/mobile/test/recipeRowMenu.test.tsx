import { KeyLowProvider, keys } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeLibrary } from "../components/RecipeLibrary";
import {
  archivedSampleRecipes,
  sampleRecipes,
} from "../components/RecipeLibraryView/sampleRecipes";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { heldCopies, recipeWritesClient } from "./support/recipeWritesBackend";

import type { RecipeSummary } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The row menu of the recipe library, with the real hooks over the diary's fake database: Duplicate and
// Archive, their toasts, Undo, and a write that fails.

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

let queryClient: QueryClient;

async function renderLibrary() {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={recipeWritesClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeLibrary />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByLabelText("Recipes");
  return user;
}

// A row is two buttons, the one that opens it and its More, so the open ones are told apart by their names.
// Each is named by its recipe, then a comma, so a copy never stands in for its original.
function expectRows(names: readonly string[]) {
  const buttons = within(screen.getByLabelText("Recipes")).getAllByRole("button", {
    name: /, open$/,
  });
  expect(buttons).toHaveLength(names.length);
  names.forEach((name, index) => {
    expect(buttons[index]).toHaveAccessibleName(
      new RegExp(`^${name.replaceAll("(", "\\(").replaceAll(")", "\\)")},`),
    );
  });
}

const rowCount = () =>
  within(screen.getByLabelText("Recipes")).getAllByRole("button", { name: /, open$/ }).length;

const moreButton = (name: string) => screen.getByRole("button", { name: `More for ${name}` });
const archivedLink = () => screen.getByRole("button", { name: /^Archived recipes/ });
const toast = (name: string) => screen.findByRole("status", { name });
const writesTo = (table: string) =>
  diaryBackend.requests.filter((request) => request.table === table && request.method !== "GET");

describe("the library's row menu", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeLibrary",
      "components/RecipeLibraryView",
      "components/RecipeRowMenu",
      "components/ScreenHeader",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.recipes = [...archivedSampleRecipes, ...sampleRecipes].map((recipe) => ({
      ...recipe,
    }));
    jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    heldCopies.isHolding = false;
    heldCopies.held = [];
    queryClient.clear();
    jest.restoreAllMocks();
  });

  describe("More", () => {
    it("should be named for its recipe, on every row", async () => {
      await renderLibrary();

      expect(screen.getAllByRole("button", { name: /^More for / })).toHaveLength(5);
      expect(moreButton("Chicken and rice")).toBeOnTheScreen();
    });

    it("should open the recipe's name over Duplicate and Archive, each with its caption", async () => {
      const user = await renderLibrary();

      await user.press(moreButton("Chicken and rice"));

      expect(await screen.findByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Archive, Hidden until you restore it" }),
      ).toBeEnabled();
    });

    it("should be disabled with the rest of the writes when the phone is offline", async () => {
      await renderLibrary();

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(await screen.findByText("You're offline")).toBeOnTheScreen();
      expect(moreButton("Chicken and rice")).toBeDisabled();
      expect(moreButton("Beef chilli")).toBeDisabled();
    });
  });

  describe("Archive", () => {
    async function archiveChickenAndRice() {
      const user = await renderLibrary();
      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Archive, Hidden until you restore it" }),
      );
      return user;
    }

    it("should close the menu, take the row out of the list and say Recipe archived with Undo", async () => {
      await archiveChickenAndRice();

      expect(await toast("Recipe archived")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      expectRows([
        "Beef chilli",
        "Lentil and tomato soup",
        "Overnight oats",
        "Spinach and cheddar frittata",
      ]);
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Chicken and rice" })).not.toBeOnTheScreen();
      });
    });

    it("should count one more under Archived recipes", async () => {
      await archiveChickenAndRice();
      await toast("Recipe archived");

      expect(archivedLink()).toHaveAccessibleName("Archived recipes, 3");
    });

    it("should change nothing but the archived flag", async () => {
      await archiveChickenAndRice();
      await toast("Recipe archived");

      expect(writesTo("recipes")).toHaveLength(1);
      expect(diaryBackend.recipes.find((recipe) => recipe["name"] === "Chicken and rice")).toEqual(
        expect.objectContaining({ is_archived: true }),
      );
    });

    it("should bring the recipe back to its place with Undo", async () => {
      const user = await archiveChickenAndRice();
      await toast("Recipe archived");

      await user.press(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(rowCount()).toBe(5);
      });
      expectRows([
        "Beef chilli",
        "Chicken and rice",
        "Lentil and tomato soup",
        "Overnight oats",
        "Spinach and cheddar frittata",
      ]);
      expect(archivedLink()).toHaveAccessibleName("Archived recipes, 2");
    });

    it("should put the row back and say one fixed sentence when the write fails", async () => {
      diaryBackend.failingWriteTables.add("recipes");
      await archiveChickenAndRice();

      expect(await toast("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(rowCount()).toBe(5);
      expect(screen.queryByText("Recipe archived")).not.toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });
  });

  describe("a failed write, with the library not read again", () => {
    it("should put the row back by itself and stop a fetch under way first", async () => {
      const user = await renderLibrary();
      const cancel = jest.spyOn(queryClient, "cancelQueries");
      // Every read from here on never answers, so only the explicit rollback can bring the row back.
      diaryBackend.hungTables.add("recipes");
      diaryBackend.failingWriteTables.add("recipes");
      void queryClient.refetchQueries({ queryKey: keys.recipes.all });

      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Archive, Hidden until you restore it" }),
      );

      expect(await toast("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(cancel).toHaveBeenCalledWith({ queryKey: keys.recipes.all });
      expect(rowCount()).toBe(5);
      expect(screen.getByRole("button", { name: /^Chicken and rice,/ })).toBeOnTheScreen();
    });
  });

  describe("Duplicate", () => {
    async function duplicate(name: string) {
      const user = await renderLibrary();
      await user.press(moreButton(name));
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );
      return user;
    }

    it("should sit the copy straight after the original and say Recipe duplicated with Undo", async () => {
      await duplicate("Chicken and rice");

      expect(await toast("Recipe duplicated")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      await waitFor(() => {
        expect(rowCount()).toBe(6);
      });
      expectRows([
        "Beef chilli",
        "Chicken and rice",
        "Chicken and rice (copy)",
        "Lentil and tomato soup",
        "Overnight oats",
        "Spinach and cheddar frittata",
      ]);
    });

    it("should put only the library columns of the copy in the cached list, as the web twin does", async () => {
      const user = await renderLibrary();
      const editedLists: RecipeSummary[][] = [];
      queryClient.getQueryCache().subscribe((event) => {
        const isEditByHand =
          event.type === "updated" && event.action.type === "success" && event.action.manual;
        const list = queryClient.getQueryData<RecipeSummary[]>(keys.recipes.list(true));
        if (isEditByHand && list !== undefined) {
          editedLists.push(list);
        }
      });

      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );
      await toast("Recipe duplicated");

      const withCopy = editedLists.find((list) =>
        list.some(({ name }) => name === "Chicken and rice (copy)"),
      );
      const copy = withCopy?.find(({ name }) => name === "Chicken and rice (copy)");
      expect(Object.keys(copy ?? {}).sort()).toEqual([
        "computed",
        "id",
        "is_archived",
        "name",
        "servings",
        "yield_grams",
      ]);
    });

    it("should keep the original as it was", async () => {
      await duplicate("Chicken and rice");
      await toast("Recipe duplicated");

      expect(archivedLink()).toHaveAccessibleName("Archived recipes, 2");
      expect(writesTo("recipes")).toHaveLength(0);
      expect(writesTo("save_recipe")).toHaveLength(1);
    });

    it("should name a second copy of the same recipe (copy 2)", async () => {
      const user = await duplicate("Chicken and rice");
      await waitFor(() => {
        expect(rowCount()).toBe(6);
      });

      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );

      await waitFor(() => {
        expect(rowCount()).toBe(7);
      });
      // Their order is the database's, by name, which this test does not pin.
      expect(screen.getByRole("button", { name: /^Chicken and rice \(copy\),/ })).toBeOnTheScreen();
      expect(
        screen.getByRole("button", { name: /^Chicken and rice \(copy 2\),/ }),
      ).toBeOnTheScreen();
    });

    it("should archive the copy with Undo, and never delete a recipe", async () => {
      const user = await duplicate("Chicken and rice");
      await waitFor(() => {
        expect(rowCount()).toBe(6);
      });

      await user.press(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(rowCount()).toBe(5);
      });
      expect(
        screen.queryByRole("button", { name: /^Chicken and rice \(copy\),/ }),
      ).not.toBeOnTheScreen();
      expect(archivedLink()).toHaveAccessibleName("Archived recipes, 3");
      expect(diaryBackend.requests.some((request) => request.method === "DELETE")).toBe(false);
      expect(diaryBackend.recipes.find((r) => r["name"] === "Chicken and rice (copy)")).toEqual(
        expect.objectContaining({ is_archived: true }),
      );
    });

    it("should not reuse the name of a copy that was put away with Undo", async () => {
      const user = await duplicate("Chicken and rice");
      await waitFor(() => {
        expect(rowCount()).toBe(6);
      });
      await user.press(screen.getByRole("button", { name: "Undo" }));
      await waitFor(() => {
        expect(rowCount()).toBe(5);
      });

      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );

      expect(
        await screen.findByRole("button", { name: /^Chicken and rice \(copy 2\),/ }),
      ).toBeOnTheScreen();
    });

    it("should make one copy for a double tap on Duplicate", async () => {
      const user = await renderLibrary();
      await user.press(moreButton("Chicken and rice"));
      const item = await screen.findByRole("button", {
        name: "Duplicate, Makes a copy you can change",
      });

      await act(async () => {
        await fireEvent.press(item);
        await fireEvent.press(item);
      });

      expect(await toast("Recipe duplicated")).toBeOnTheScreen();
      await waitFor(() => {
        expect(rowCount()).toBe(6);
      });
      expect(writesTo("save_recipe")).toHaveLength(1);
    });

    it("should name two quick copies (copy) and (copy 2), the first still being saved", async () => {
      heldCopies.isHolding = true;
      const user = await renderLibrary();
      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );
      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );

      await waitFor(() => {
        expect(heldCopies.held.length).toBeGreaterThan(0);
      });
      await act(() => {
        heldCopies.isHolding = false;
        heldCopies.held.splice(0).forEach((release) => {
          release();
        });
      });

      await waitFor(() => {
        expect(rowCount()).toBe(7);
      });
      const names = diaryBackend.recipes.map((recipe) => recipe["name"]);
      expect(names).toEqual(
        expect.arrayContaining(["Chicken and rice (copy)", "Chicken and rice (copy 2)"]),
      );
    });

    it("should name a second copy (copy 2) before the library has been read again", async () => {
      const user = await renderLibrary();
      // The read after a save never answers, so the list can only be the cache the hook left.
      await user.press(moreButton("Chicken and rice"));
      diaryBackend.hungTables.add("recipes");
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );
      await toast("Recipe duplicated");

      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );

      await waitFor(() => {
        expect(writesTo("save_recipe")).toHaveLength(2);
      });
      expect(diaryBackend.recipes.map((recipe) => recipe["name"])).toContain(
        "Chicken and rice (copy 2)",
      );
    });

    it("should free the name of a copy that failed, so the next one is (copy) and not (copy 2)", async () => {
      diaryBackend.failingWriteTables.add("recipes");
      const user = await duplicate("Chicken and rice");
      await toast("Something went wrong. Try again.");
      diaryBackend.failingWriteTables.clear();

      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );

      expect(
        await screen.findByRole("button", { name: /^Chicken and rice \(copy\),/ }),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^Chicken and rice \(copy 2\),/ }),
      ).not.toBeOnTheScreen();
    });

    it("should not add a copy twice when the library has already been read with it in", async () => {
      heldCopies.isHolding = true;
      const user = await renderLibrary();
      await user.press(moreButton("Chicken and rice"));
      await user.press(
        await screen.findByRole("button", { name: "Duplicate, Makes a copy you can change" }),
      );
      await waitFor(() => {
        expect(heldCopies.held.length).toBeGreaterThan(0);
      });

      // The save is let go and, before the hook hears of it, the list is read with the copy in. The reads
      // after that never answer, so the list is what the hook leaves.
      await act(() => {
        heldCopies.isHolding = false;
        heldCopies.held.splice(0).forEach((release) => {
          release();
        });
        const copy = diaryBackend.recipes.find(
          (recipe) => recipe["name"] === "Chicken and rice (copy)",
        );
        diaryBackend.hungTables.add("recipes");
        queryClient.setQueryData<RecipeSummary[]>(keys.recipes.list(true), (recipes = []) => [
          ...recipes,
          ...sampleRecipes
            .filter((recipe) => recipe.name === "Chicken and rice")
            .map((original) => ({
              ...original,
              id: String(copy?.["id"]),
              name: "Chicken and rice (copy)",
            })),
        ]);
      });

      expect(await toast("Recipe duplicated")).toBeOnTheScreen();
      expect(rowCount()).toBe(6);
    });

    it("should make no copy and say one fixed sentence when the write fails", async () => {
      diaryBackend.failingWriteTables.add("recipes");
      await duplicate("Chicken and rice");

      expect(await toast("Something went wrong. Try again.")).toBeOnTheScreen();
      expect(rowCount()).toBe(5);
      expect(screen.queryByText("Recipe duplicated")).not.toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });
  });
});
