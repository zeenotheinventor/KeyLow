import { KeyLowProvider, keys } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { ArchivedRecipesScreen } from "../components/ArchivedRecipesScreen";
import { archivedSampleRecipes } from "../components/RecipeLibraryView/sampleRecipes";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { recipeWritesClient } from "./support/recipeWritesBackend";

import type { QueryClient } from "@tanstack/react-query";

// The archived recipes screen, with the real hooks over the diary's fake database.

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

async function renderArchived() {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={recipeWritesClient} queryClient={queryClient}>
        <ToastProvider>
          <ArchivedRecipesScreen />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const list = () => screen.findByLabelText("Archived recipes");
const restoreButton = (name: string) => screen.getByRole("button", { name: `Restore ${name}` });
const note =
  "Archived recipes are hidden from your list and from food search. Diary entries keep their values.";

describe("the archived recipes screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/ArchivedRecipesView",
      "components/ArchivedRecipesScreen",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.recipes = archivedSampleRecipes.map((recipe) => ({ ...recipe }));
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

  describe("what it shows", () => {
    it("should head the screen Archived recipes, with Back, and say what archived means", async () => {
      await renderArchived();
      await list();

      expect(screen.getByRole("heading", { name: "Archived recipes" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
      expect(screen.getByText(note)).toBeOnTheScreen();
    });

    it("should list the archived recipes with their serving, yield and values of one serving", async () => {
      await renderArchived();
      await list();

      const meatballs = within(screen.getByLabelText(/^Turkey meatballs,/));
      expect(meatballs.getByText("1 serving (210 g) · makes 4")).toBeOnTheScreen();
      expect(meatballs.getByText("298")).toBeOnTheScreen();
      const chilli = within(screen.getByLabelText(/^Veggie chilli,/));
      expect(chilli.getByText("1 serving (380 g) · makes 4")).toBeOnTheScreen();
      expect(chilli.getByText("301")).toBeOnTheScreen();
    });

    it("should give each row a Restore button named for its recipe, and nothing else to press", async () => {
      await renderArchived();
      await list();

      expect(restoreButton("Turkey meatballs")).toHaveTextContent("Restore");
      expect(restoreButton("Veggie chilli")).toBeOnTheScreen();
      expect(screen.getAllByRole("button")).toHaveLength(3);
      expect(screen.queryByRole("button", { name: /, open$/ })).not.toBeOnTheScreen();
    });

    it("should leave the live recipes out", async () => {
      diaryBackend.recipes = [
        ...archivedSampleRecipes.map((recipe) => ({ ...recipe })),
        {
          ...archivedSampleRecipes[0],
          id: "00000000-0000-4000-8000-000000000099",
          name: "Live",
          is_archived: false,
        },
      ];
      await renderArchived();
      await list();

      expect(screen.queryByText("Live")).not.toBeOnTheScreen();
    });

    it("should say Nothing archived under the note when none is archived", async () => {
      diaryBackend.recipes = [];
      await renderArchived();

      expect(await screen.findByRole("heading", { name: "Nothing archived" })).toBeOnTheScreen();
      expect(screen.getByText(note)).toBeOnTheScreen();
    });
  });

  describe("Restore", () => {
    it("should take the row out at once and say Recipe restored, with no action", async () => {
      const user = await renderArchived();
      await list();

      await user.press(restoreButton("Turkey meatballs"));

      expect(await screen.findByRole("status", { name: "Recipe restored" })).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: "Restore Turkey meatballs" }),
      ).not.toBeOnTheScreen();
      expect(restoreButton("Veggie chilli")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
    });

    it("should move the recipe back into the library", async () => {
      const user = await renderArchived();
      await list();

      await user.press(restoreButton("Turkey meatballs"));
      await screen.findByRole("status", { name: "Recipe restored" });

      expect(diaryBackend.recipes.find((recipe) => recipe["name"] === "Turkey meatballs")).toEqual(
        expect.objectContaining({ is_archived: false }),
      );
      const library = queryClient.getQueryData<{ name: string; is_archived: boolean }[]>(
        keys.recipes.list(true),
      );
      expect(library?.find((recipe) => recipe.name === "Turkey meatballs")?.is_archived).toBe(
        false,
      );
    });

    it("should say Nothing archived once the last one is restored", async () => {
      const user = await renderArchived();
      await list();

      await user.press(restoreButton("Turkey meatballs"));
      await user.press(restoreButton("Veggie chilli"));

      expect(await screen.findByRole("heading", { name: "Nothing archived" })).toBeOnTheScreen();
      expect(screen.getByText(note)).toBeOnTheScreen();
    });

    it("should put the row back and say one fixed sentence when the write fails", async () => {
      diaryBackend.failingWriteTables.add("recipes");
      const user = await renderArchived();
      await list();

      await user.press(restoreButton("Turkey meatballs"));

      expect(
        await screen.findByRole("status", { name: "Something went wrong. Try again." }),
      ).toBeOnTheScreen();
      await waitFor(() => {
        expect(restoreButton("Turkey meatballs")).toBeOnTheScreen();
      });
      expect(screen.queryByText("Recipe restored")).not.toBeOnTheScreen();
      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });

    it("should be disabled while offline, with the recipes still readable from memory", async () => {
      await renderArchived();
      await list();

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(await screen.findByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("Showing your recipes from this session. Changes need a connection."),
      ).toBeOnTheScreen();
      expect(restoreButton("Turkey meatballs")).toBeDisabled();
      expect(restoreButton("Veggie chilli")).toBeDisabled();
    });
  });

  describe("Back", () => {
    it("should return to the library", async () => {
      const user = await renderArchived();
      await list();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should go to the library when a link opened the screen with nothing before it", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderArchived();
      await list();

      await user.press(screen.getByRole("button", { name: "Back" }));

      expect(routerMock.replace).toHaveBeenCalledWith("/recipes");
    });
  });

  describe("without the recipes in memory", () => {
    it("should say Loading your recipes while the read is slow", async () => {
      diaryBackend.hungTables.add("recipes");
      await renderArchived();

      expect(await screen.findByRole("status", { name: "Loading your recipes" })).toBeOnTheScreen();
    });

    it("should say Couldn't load your recipes, and read again on Try again", async () => {
      diaryBackend.failingTables.add("recipes");
      const user = await renderArchived();
      await screen.findByText("Couldn't load your recipes");

      diaryBackend.failingTables.delete("recipes");
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await list()).toBeOnTheScreen();
    });

    it("should say that recipes need a connection when it starts offline", async () => {
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderArchived();

      expect(
        await screen.findByText(
          "Recipes need a connection. They'll appear when you're back online.",
        ),
      ).toBeOnTheScreen();
    });
  });
});
