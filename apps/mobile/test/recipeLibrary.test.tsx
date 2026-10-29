import { KeyLowProvider, keys } from "@keylow/api-client";
import { dehydrate, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeLibrary } from "../components/RecipeLibrary";
import {
  archivedSampleRecipes,
  sampleRecipes,
} from "../components/RecipeLibraryView/sampleRecipes";
import { ToastProvider } from "../components/ui";
import { isPersistedQuery } from "../lib/diaryCache/isPersistedQuery";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  requestsTo,
  resetDiaryBackend,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { QueryClient } from "@tanstack/react-query";

// The recipe library in More, read through the real api-client over a fake database.

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
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <RecipeLibrary />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

const field = () => screen.getByRole("searchbox", { name: "Search recipes" });
const library = () => screen.findByLabelText("Recipes");
// A row is two buttons, the one that opens it and its More, so the open ones are told apart by their names.
const openButtons = () =>
  within(screen.getByLabelText("Recipes")).getAllByRole("button", { name: /, open$/ });
const goOffline = () =>
  act(() => {
    onlineManager.setOnline(false);
  });

describe("the recipe library screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeLibrary",
      "components/RecipeLibraryView",
      "components/ScreenHeader",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.recipes = [...archivedSampleRecipes, ...sampleRecipes];
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

  describe("reading the recipes", () => {
    it("should list the five live recipes and leave the two archived ones out", async () => {
      await renderLibrary();
      await library();

      expect(openButtons()).toHaveLength(5);
      expect(screen.queryByText("Turkey meatballs")).not.toBeOnTheScreen();
      expect(screen.queryByText("Veggie chilli")).not.toBeOnTheScreen();
    });

    it("should make one recipes request, which brings the archived recipes too", async () => {
      await renderLibrary();
      await library();

      const requests = diaryBackend.requests.filter((request) => request.table === "recipes");
      expect(requests).toHaveLength(1);
      // A filter on is_archived would leave the archived recipes out.
      expect(requests[0]?.search).not.toContain("is_archived=");
    });

    it("should filter the loaded list without another request", async () => {
      const user = await renderLibrary();
      await library();

      await user.type(field(), "chi");

      expect(openButtons()).toHaveLength(2);
      expect(requestsTo("recipes")).toBe(1);
    });

    it("should read nothing until the account has accepted the current Terms", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderLibrary();

      expect(await screen.findByRole("status", { name: "Loading your recipes" })).toBeOnTheScreen();
      expect(requestsTo("recipes")).toBe(0);
    });
  });

  describe("where it leads", () => {
    it("should open the recipe's view from a row", async () => {
      const user = await renderLibrary();
      await library();

      await user.press(screen.getByRole("button", { name: /^Chicken and rice,/ }));

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith(`/recipes/${sampleRecipes[1]?.id}`);
    });

    it("should open the new recipe editor from the header", async () => {
      const user = await renderLibrary();
      await library();

      await user.press(screen.getByRole("button", { name: "New recipe" }));

      expect(routerMock.push).toHaveBeenCalledWith("/recipes/new");
    });

    it("should open the new recipe editor with the typed word as the name parameter", async () => {
      const user = await renderLibrary();
      await library();
      await user.type(field(), "pasta");

      const [, inTheEmptyState] = screen.getAllByRole("button", { name: "New recipe" });
      if (inTheEmptyState !== undefined) {
        await user.press(inTheEmptyState);
      }

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/recipes/new?name=pasta");
    });

    it("should go back to More, which it was pushed from, on its back control", async () => {
      const user = await renderLibrary();
      await library();

      await user.press(screen.getByRole("button", { name: "Back to More" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should go to More when a link opened the library with nothing before it", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderLibrary();
      await library();

      await user.press(screen.getByRole("button", { name: "Back to More" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/(tabs)/more");
    });
  });

  describe("the Archived recipes row", () => {
    const archivedLink = () => screen.getByRole("button", { name: "Archived recipes, 2" });

    it("should sit under the list with the count of archived recipes", async () => {
      await renderLibrary();
      await library();

      expect(archivedLink()).toBeOnTheScreen();
      expect(within(archivedLink()).getByText("2")).toBeOnTheScreen();
    });

    it("should open the archived recipes inside the More tab", async () => {
      const user = await renderLibrary();
      await library();

      await user.press(archivedLink());

      expect(routerMock.push).toHaveBeenCalledTimes(1);
      expect(routerMock.push).toHaveBeenCalledWith("/more/recipes/archived");
    });

    it("should be hidden while a search is typed, because archived recipes are not searched", async () => {
      const user = await renderLibrary();
      await library();

      await user.type(field(), "chi");

      expect(screen.queryByRole("button", { name: /^Archived recipes/ })).not.toBeOnTheScreen();
    });

    it("should be hidden when nothing is archived", async () => {
      diaryBackend.recipes = [...sampleRecipes];
      await renderLibrary();
      await library();

      expect(screen.queryByRole("button", { name: /^Archived recipes/ })).not.toBeOnTheScreen();
    });

    it("should stay under No recipes yet when every recipe is archived", async () => {
      diaryBackend.recipes = [...archivedSampleRecipes];
      await renderLibrary();

      expect(await screen.findByRole("heading", { name: "No recipes yet" })).toBeOnTheScreen();
      expect(archivedLink()).toBeOnTheScreen();
    });
  });

  describe("states", () => {
    it("should say Loading your recipes while the read is slow", async () => {
      diaryBackend.hungTables.add("recipes");
      await renderLibrary();

      expect(await screen.findByRole("status", { name: "Loading your recipes" })).toBeOnTheScreen();
      expect(field()).toBeDisabled();
    });

    it("should say No recipes yet when the user has none", async () => {
      diaryBackend.recipes = [];
      await renderLibrary();

      expect(await screen.findByRole("heading", { name: "No recipes yet" })).toBeOnTheScreen();
    });

    it("should keep saying No recipes yet when only archived recipes exist", async () => {
      diaryBackend.recipes = [...archivedSampleRecipes];
      await renderLibrary();

      expect(await screen.findByRole("heading", { name: "No recipes yet" })).toBeOnTheScreen();
    });

    it("should say Couldn't load your recipes when the read fails, and read again on Try again", async () => {
      diaryBackend.failingTables.add("recipes");
      const user = await renderLibrary();
      await screen.findByText("Couldn't load your recipes");
      expect(screen.queryByRole("searchbox")).not.toBeOnTheScreen();

      diaryBackend.failingTables.delete("recipes");
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await library()).toBeOnTheScreen();
      expect(requestsTo("recipes")).toBe(2);
    });

    it("should show no raw database text when the read fails", async () => {
      diaryBackend.failingTables.add("recipes");
      await renderLibrary();
      await screen.findByText("Couldn't load your recipes");

      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    it("should show the offline notice and no list when it starts offline, and ask for nothing", async () => {
      await goOffline();
      await renderLibrary();

      expect(await screen.findByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("Recipes need a connection. They'll appear when you're back online."),
      ).toBeOnTheScreen();
      expect(screen.queryByLabelText("Recipes")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "New recipe" })).toBeDisabled();
      expect(requestsTo("recipes")).toBe(0);
    });

    it("should keep the recipes it loaded when the phone goes offline, and say they are from this session", async () => {
      const user = await renderLibrary();
      await library();

      await goOffline();

      expect(await screen.findByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("Showing your recipes from this session. Changes need a connection."),
      ).toBeOnTheScreen();
      expect(openButtons()).toHaveLength(5);
      expect(screen.getByRole("button", { name: "New recipe" })).toBeDisabled();
      await user.press(screen.getByRole("button", { name: /^Beef chilli,/ }));
      expect(routerMock.push).toHaveBeenCalledWith(`/recipes/${sampleRecipes[0]?.id}`);
    });

    it("should treat archived recipes alone in memory as nothing in memory, not as No recipes yet", async () => {
      diaryBackend.recipes = [...archivedSampleRecipes];
      await renderLibrary();
      await screen.findByRole("heading", { name: "No recipes yet" });

      await goOffline();

      expect(await screen.findByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("Recipes need a connection. They'll appear when you're back online."),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "No recipes yet" })).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "New recipe" })).toBeDisabled();
    });

    it("should lose the notice and enable New recipe when the phone is back online", async () => {
      await renderLibrary();
      await library();
      await goOffline();
      await screen.findByText("You're offline");

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(screen.queryByText("You're offline")).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "New recipe" })).toBeEnabled();
    });
  });

  describe("the persisted offline cache", () => {
    it("should not persist any recipe query, so recipes never reach the unencrypted store", async () => {
      await renderLibrary();
      await library();
      // A recipe's own query and a name search are recipe queries too.
      queryClient.setQueryData(keys.recipes.detail(sampleRecipes[0]?.id ?? ""), {});
      queryClient.setQueryData(keys.recipes.search("chi"), []);

      const recipeQueries = queryClient
        .getQueryCache()
        .findAll({ queryKey: keys.recipes.all })
        .filter((query) => query.state.status === "success");
      const persisted = dehydrate(queryClient, { shouldDehydrateQuery: isPersistedQuery });

      expect(recipeQueries.length).toBeGreaterThanOrEqual(3);
      expect(recipeQueries.some((query) => isPersistedQuery(query))).toBe(false);
      expect(persisted.queries.some((query) => query.queryKey[0] === "recipes")).toBe(false);
    });
  });
});
