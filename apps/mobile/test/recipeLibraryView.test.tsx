import { themes } from "@keylow/tokens";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { RecipeLibraryView } from "../components/RecipeLibraryView";
import { sampleRecipes } from "../components/RecipeLibraryView/sampleRecipes";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { RecipeLibraryViewProps } from "../components/RecipeLibraryView";
import type { RecipeSummary } from "@keylow/api-client";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

setUpTests();

const onOpenRecipe = jest.fn<undefined, [string]>();
const onNewRecipe = jest.fn<undefined, [string?]>();
const onRetry = jest.fn<undefined, []>();
const onOpenArchived = jest.fn<undefined, []>();
const onDuplicateRecipe = jest.fn<undefined, [RecipeSummary]>();
const onArchiveRecipe = jest.fn<undefined, [RecipeSummary]>();

const actions = {
  onOpenRecipe,
  onNewRecipe,
  onOpenArchived,
  onDuplicateRecipe,
  onArchiveRecipe,
};

const ready: RecipeLibraryViewProps = { status: "ready", recipes: sampleRecipes, ...actions };

async function renderLibrary(
  props: RecipeLibraryViewProps = ready,
  scheme: "dark" | "light" = "dark",
) {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <RecipeLibraryView {...props} />
    </ThemeProvider>,
  );
}

const user = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
const field = () => screen.getByRole("searchbox", { name: "Search recipes" });
const library = () => screen.getByLabelText("Recipes");
// A row is two buttons, the one that opens it and its More, so the open ones are told apart by their names.
const openButtons = () => within(library()).getAllByRole("button", { name: /, open$/ });

// The rows' open buttons, in order, each named as the string or pattern at its place.
function expectOpenButtonsNamed(names: readonly (string | RegExp)[]) {
  const buttons = openButtons();
  expect(buttons).toHaveLength(names.length);
  names.forEach((name, index) => {
    expect(buttons[index]).toHaveAccessibleName(name);
  });
}
const newRecipeButtons = () => screen.getAllByRole("button", { name: "New recipe" });
const hidden = { includeHiddenElements: true };

// The brief's table of the five rows, in name order: the caption and the stats line of each.
const boardRows = [
  ["Beef chilli", "1 serving (350 g) · makes 6", "412", "34 P", "31 C", "16 F"],
  ["Chicken and rice", "1 serving (275 g) · makes 4", "374", "32 P", "43 C", "8.1 F"],
  ["Lentil and tomato soup", "1 serving (400 g) · makes 4", "238", "15 P", "36 C", "3.2 F"],
  ["Overnight oats", "1 serving (290 g) · makes 1", "389", "20 P", "52 C", "11 F"],
  ["Spinach and cheddar frittata", "1 serving (155 g) · makes 4", "217", "15 P", "3.5 C", "16 F"],
] as const;

describe("the recipe library", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/RecipeLibraryView",
      "components/ScreenHeader",
    ]);
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    // React Native's jest setup already makes this a mock, so calls from an earlier test are still on it.
    jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockClear()
      .mockImplementation(() => undefined);
    onOpenRecipe.mockReset();
    onNewRecipe.mockReset();
    onRetry.mockReset();
    onOpenArchived.mockReset();
    onDuplicateRecipe.mockReset();
    onArchiveRecipe.mockReset();
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("with recipes", () => {
    it("should head the screen Recipes, with New recipe at the end of the header", async () => {
      await renderLibrary();

      expect(screen.getByRole("heading", { name: "Recipes" })).toBeOnTheScreen();
      expect(newRecipeButtons()).toHaveLength(1);
    });

    it("should offer a search field named Search recipes", async () => {
      await renderLibrary();

      expect(field()).toBeOnTheScreen();
      expect(field()).toBeEnabled();
      expect(field().props.placeholder).toBe("Search recipes");
    });

    it("should list the five recipes in name order, each as one button named in words", async () => {
      await renderLibrary();

      expectOpenButtonsNamed([
        "Beef chilli, 1 serving 350 grams, makes 6, 412 kilocalories, protein 34 grams, carbohydrate 31 grams, fat 16 grams, open",
        "Chicken and rice, 1 serving 275 grams, makes 4, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, open",
        "Lentil and tomato soup, 1 serving 400 grams, makes 4, 238 kilocalories, protein 15 grams, carbohydrate 36 grams, fat 3.2 grams, open",
        "Overnight oats, 1 serving 290 grams, makes 1, 389 kilocalories, protein 20 grams, carbohydrate 52 grams, fat 11 grams, open",
        "Spinach and cheddar frittata, 1 serving 155 grams, makes 4, 217 kilocalories, protein 15 grams, carbohydrate 3.5 grams, fat 16 grams, open",
      ]);
    });

    it.each(boardRows)(
      "should write %s with its serving and yield and the values of one serving",
      async (name, caption, kilocalories, protein, carbs, fat) => {
        await renderLibrary();

        const row = within(screen.getByRole("button", { name: new RegExp(`^${name},`) }));
        expect(row.getByText(name)).toBeOnTheScreen();
        expect(row.getByText(caption)).toBeOnTheScreen();
        expect(row.getByText(kilocalories)).toBeOnTheScreen();
        expect(row.getByText("kcal")).toBeOnTheScreen();
        expect(row.getByText(protein)).toBeOnTheScreen();
        expect(row.getByText(carbs)).toBeOnTheScreen();
        expect(row.getByText(fat)).toBeOnTheScreen();
      },
    );

    it("should not draw the archived recipes row when nothing is archived", async () => {
      await renderLibrary();

      expect(screen.queryByRole("button", { name: /^Archived recipes/ })).not.toBeOnTheScreen();
    });

    it("should open the recipe that is pressed", async () => {
      await renderLibrary();

      await user().press(screen.getByRole("button", { name: /^Chicken and rice,/ }));

      expect(onOpenRecipe).toHaveBeenCalledTimes(1);
      expect(onOpenRecipe).toHaveBeenCalledWith(sampleRecipes[1]?.id);
    });

    it("should start a new recipe with no name from the header", async () => {
      await renderLibrary();

      await user().press(screen.getByRole("button", { name: "New recipe" }));

      expect(onNewRecipe).toHaveBeenCalledTimes(1);
      expect(onNewRecipe).toHaveBeenCalledWith();
    });
  });

  describe("a recipe with a figure missing", () => {
    type Figures = (typeof sampleRecipes)[number]["computed"]["perServing"];

    // Beef chilli, the first of the sample, with some of its per serving figures taken away.
    function recipesWithBeefChilliMissing(figures: Partial<Figures>) {
      return sampleRecipes.map((recipe, index) =>
        index === 0
          ? {
              ...recipe,
              computed: {
                ...recipe.computed,
                perServing: { ...recipe.computed.perServing, ...figures },
              },
            }
          : recipe,
      );
    }

    it("should say Needs review on its stats line and in its name, with the values it has left out", async () => {
      await renderLibrary({ ...ready, recipes: recipesWithBeefChilliMissing({ fat_g: null }) });

      const row = screen.getByRole("button", { name: /^Beef chilli,/ });
      expect(within(row).getByText("Needs review")).toBeOnTheScreen();
      expect(within(row).queryByText("34 P")).not.toBeOnTheScreen();
      expect(row).toHaveAccessibleName(/412 kilocalories, Needs review, open$/);
    });

    it("should say Needs review, with no flame, when every figure is missing", async () => {
      await renderLibrary({
        ...ready,
        recipes: recipesWithBeefChilliMissing({
          kcal: null,
          protein_g: null,
          carbs_g: null,
          fat_g: null,
        }),
      });

      const row = screen.getByRole("button", { name: /^Beef chilli,/ });
      expect(within(row).getByText("Needs review")).toBeOnTheScreen();
      expect(within(row).queryByText("kcal")).not.toBeOnTheScreen();
      expect(row).toHaveAccessibleName(/makes 6, Needs review, open$/);
    });

    it("should say nothing of review for a recipe with every figure", async () => {
      await renderLibrary();

      expect(screen.queryByText("Needs review")).not.toBeOnTheScreen();
    });
  });

  describe("the More menu", () => {
    const more = () => screen.getByRole("button", { name: "More for Chicken and rice" });
    const duplicateItem = () =>
      screen.getByRole("button", { name: "Duplicate, Makes a copy you can change" });
    const archiveItem = () =>
      screen.getByRole("button", { name: "Archive, Hidden until you restore it" });

    it("should give every row a More button named for its recipe, beside the row and not in it", async () => {
      await renderLibrary();

      expect(screen.getAllByRole("button", { name: /^More for / })).toHaveLength(5);
      expect(
        within(screen.getByRole("button", { name: /^Beef chilli,/ })).queryByRole("button"),
      ).toBeNull();
    });

    it.each(["dark", "light"] as const)(
      "should draw the More glyph in secondary text, in the %s scheme",
      async (scheme) => {
        await renderLibrary(ready, scheme);

        const [glyph] = more().queryAll((node) => node.type === "RNSVGSvgView");
        expect(glyph).toHaveProp("stroke", themes[scheme]["text-secondary"]);
      },
    );

    it("should open the sheet with the recipe's name and its two actions", async () => {
      await renderLibrary();

      await user().press(more());

      expect(await screen.findByRole("heading", { name: "Chicken and rice" })).toBeOnTheScreen();
      expect(duplicateItem()).toBeEnabled();
      expect(archiveItem()).toBeEnabled();
      expect(onDuplicateRecipe).not.toHaveBeenCalled();
      expect(onArchiveRecipe).not.toHaveBeenCalled();
    });

    it("should not press the row", async () => {
      await renderLibrary();

      await user().press(more());

      expect(onOpenRecipe).not.toHaveBeenCalled();
    });

    it("should duplicate the recipe at once, with no confirmation, and close", async () => {
      await renderLibrary();
      await user().press(more());

      await user().press(await screen.findByRole("button", { name: /^Duplicate,/ }));

      expect(onDuplicateRecipe).toHaveBeenCalledTimes(1);
      expect(onDuplicateRecipe).toHaveBeenCalledWith(sampleRecipes[1]);
      expect(onArchiveRecipe).not.toHaveBeenCalled();
    });

    it("should archive the recipe at once, with no confirmation, and close", async () => {
      await renderLibrary();
      await user().press(more());

      await user().press(await screen.findByRole("button", { name: /^Archive,/ }));

      expect(onArchiveRecipe).toHaveBeenCalledTimes(1);
      expect(onArchiveRecipe).toHaveBeenCalledWith(sampleRecipes[1]);
      expect(onDuplicateRecipe).not.toHaveBeenCalled();
    });

    it("should be dimmed and stop responding when the recipes are only from this session", async () => {
      await renderLibrary({ ...ready, isOnline: false });

      const buttons = screen.getAllByRole("button", { name: /^More for / });
      expect(buttons).toHaveLength(5);
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe("the Archived recipes row", () => {
    const archivedLink = () => screen.getByRole("button", { name: "Archived recipes, 2" });

    it("should show the count and a way in under the list, and open the archived recipes", async () => {
      await renderLibrary({ ...ready, archivedCount: 2 });

      await user().press(archivedLink());

      expect(onOpenArchived).toHaveBeenCalledTimes(1);
    });

    it("should not be drawn when nothing is archived", async () => {
      await renderLibrary({ ...ready, archivedCount: 0 });

      expect(screen.queryByRole("button", { name: /^Archived recipes/ })).not.toBeOnTheScreen();
    });

    it("should be hidden while a search is typed, with matches or without", async () => {
      await renderLibrary({ ...ready, archivedCount: 2 });

      await user().type(field(), "chi");
      expect(screen.queryByRole("button", { name: /^Archived recipes/ })).not.toBeOnTheScreen();

      await user().clear(field());
      await user().type(field(), "pasta");
      expect(screen.queryByRole("button", { name: /^Archived recipes/ })).not.toBeOnTheScreen();
    });

    it("should stay under No recipes yet when only archived recipes exist", async () => {
      await renderLibrary({ ...ready, recipes: [], archivedCount: 2 });

      expect(screen.getByRole("heading", { name: "No recipes yet" })).toBeOnTheScreen();
      expect(archivedLink()).toBeOnTheScreen();
    });

    it("should still open when the recipes are only from this session", async () => {
      await renderLibrary({ ...ready, isOnline: false, archivedCount: 2 });

      await user().press(archivedLink());

      expect(onOpenArchived).toHaveBeenCalledTimes(1);
    });
  });

  describe("searching", () => {
    it("should leave the two recipes with chi in their name when chi is typed", async () => {
      await renderLibrary();

      await user().type(field(), "chi");

      expectOpenButtonsNamed([/^Beef chilli,/, /^Chicken and rice,/]);
    });

    it("should write the matched letters in bold and the rest of the name in regular", async () => {
      await renderLibrary();

      await user().type(field(), "chi");

      const beefChilli = within(screen.getByRole("button", { name: /^Beef chilli,/ }));
      expect(beefChilli.getByText("chi")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
      expect(beefChilli.getByText("Beef")).toHaveStyle({ fontFamily: "Geist-Regular" });
      const chickenAndRice = within(screen.getByRole("button", { name: /^Chicken and rice,/ }));
      expect(chickenAndRice.getByText("Chi")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
    });

    it("should filter from the first character", async () => {
      await renderLibrary();

      await user().type(field(), "o");

      expectOpenButtonsNamed([/^Lentil and tomato soup,/, /^Overnight oats,/]);
    });

    it("should find a word anywhere in the name, ignoring case", async () => {
      await renderLibrary();

      await user().type(field(), "RICE");

      expect(openButtons()).toHaveLength(1);
      expect(screen.getByRole("button", { name: /^Chicken and rice,/ })).toBeOnTheScreen();
    });

    it("should bring every recipe back when the search is cleared", async () => {
      await renderLibrary();
      await user().type(field(), "chi");

      await user().press(screen.getByRole("button", { name: "Clear search" }));

      expect(openButtons()).toHaveLength(5);
      expect(field()).toHaveDisplayValue("");
    });

    it("should say how many recipes it found once typing has stopped", async () => {
      await renderLibrary();
      await user().type(field(), "chi");

      expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
      await act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("2 recipes");
    });

    it("should announce only the last word typed, not every letter", async () => {
      await renderLibrary();
      await user().type(field(), "ch");
      await user().type(field(), "i");
      await act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
    });

    it("should say nothing when nothing is typed", async () => {
      await renderLibrary();
      await act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
    });
  });

  describe("when nothing matches", () => {
    async function typePasta() {
      await renderLibrary();
      await user().type(field(), "pasta");
    }

    it("should say No recipes found in place of the list, and keep the field", async () => {
      await typePasta();

      expect(screen.getByRole("heading", { name: "No recipes found" })).toBeOnTheScreen();
      expect(screen.getByText("Try another word, or create the recipe.")).toBeOnTheScreen();
      expect(screen.queryByLabelText("Recipes")).not.toBeOnTheScreen();
      expect(field()).toHaveDisplayValue("pasta");
    });

    it("should start a new recipe named with what was typed", async () => {
      await typePasta();

      const [, inTheEmptyState] = newRecipeButtons();
      expect(inTheEmptyState).toBeDefined();
      if (inTheEmptyState !== undefined) {
        await user().press(inTheEmptyState);
      }

      expect(onNewRecipe).toHaveBeenCalledTimes(1);
      expect(onNewRecipe).toHaveBeenCalledWith("pasta");
    });

    it("should announce No recipes", async () => {
      await typePasta();
      await act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith("No recipes");
    });
  });

  describe("with no recipe yet", () => {
    const empty: RecipeLibraryViewProps = { ...ready, recipes: [] };

    it("should hide the search field, with nothing to search", async () => {
      await renderLibrary(empty);

      expect(screen.queryByRole("searchbox")).not.toBeOnTheScreen();
    });

    it("should say No recipes yet with a New recipe button besides the header's", async () => {
      await renderLibrary(empty);

      expect(screen.getByRole("heading", { name: "No recipes yet" })).toBeOnTheScreen();
      expect(
        screen.getByText("Add the foods and the method once, then log it by the serving."),
      ).toBeOnTheScreen();
      expect(newRecipeButtons()).toHaveLength(2);
    });

    it("should start a new recipe with no name from the empty state", async () => {
      await renderLibrary(empty);

      const [, inTheEmptyState] = newRecipeButtons();
      if (inTheEmptyState !== undefined) {
        await user().press(inTheEmptyState);
      }

      expect(onNewRecipe).toHaveBeenCalledTimes(1);
      expect(onNewRecipe).toHaveBeenCalledWith();
    });
  });

  describe("loading", () => {
    const loading: RecipeLibraryViewProps = { status: "loading", ...actions };

    it("should name the region Loading your recipes", async () => {
      await renderLibrary(loading);

      expect(screen.getByRole("status", { name: "Loading your recipes" })).toBeOnTheScreen();
    });

    it("should draw four skeleton rows", async () => {
      await renderLibrary(loading);

      expect(screen.getAllByTestId("skeleton-recipe-row", hidden)).toHaveLength(4);
    });

    it("should draw the field disabled, and keep the header", async () => {
      await renderLibrary(loading);

      expect(field()).toBeDisabled();
      expect(screen.getByRole("heading", { name: "Recipes" })).toBeOnTheScreen();
      expect(newRecipeButtons()).toHaveLength(1);
      expect(newRecipeButtons()[0]).toBeEnabled();
    });

    it("should draw no list yet", async () => {
      await renderLibrary(loading);

      expect(screen.queryByLabelText("Recipes")).not.toBeOnTheScreen();
    });
  });

  describe("when the load failed", () => {
    const failed: RecipeLibraryViewProps = {
      status: "error",
      onRetry,
      ...actions,
    };

    it("should say Couldn't load your recipes, with the connection advice", async () => {
      await renderLibrary(failed);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Couldn't load your recipesCheck your connection and try again.",
      );
    });

    it("should hide the field and keep the header", async () => {
      await renderLibrary(failed);

      expect(screen.queryByRole("searchbox")).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Recipes" })).toBeOnTheScreen();
    });

    it("should try again when Try again is pressed", async () => {
      await renderLibrary(failed);

      await user().press(screen.getByRole("button", { name: "Try again" }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("should show no raw error text", async () => {
      await renderLibrary(failed);

      expect(screen.queryByText(/XX000|raw database/)).not.toBeOnTheScreen();
    });
  });

  describe("offline with nothing in memory", () => {
    const offline: RecipeLibraryViewProps = { status: "offline", ...actions };

    it("should say You're offline and that recipes need a connection", async () => {
      await renderLibrary(offline);

      const banner = screen.getByRole("status", { name: /offline/i });
      expect(banner).toBeOnTheScreen();
      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("Recipes need a connection. They'll appear when you're back online."),
      ).toBeOnTheScreen();
    });

    it("should draw no list, no field and no empty state", async () => {
      await renderLibrary(offline);

      expect(screen.queryByLabelText("Recipes")).not.toBeOnTheScreen();
      expect(screen.queryByRole("searchbox")).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: /No recipes/ })).not.toBeOnTheScreen();
    });

    it("should dim New recipe and stop it responding", async () => {
      await renderLibrary(offline);

      const button = screen.getByRole("button", { name: "New recipe" });
      expect(button).toBeDisabled();
      await user().press(button);

      expect(onNewRecipe).not.toHaveBeenCalled();
    });
  });

  describe("offline with the recipes loaded earlier in the session", () => {
    const readable: RecipeLibraryViewProps = { ...ready, isOnline: false };

    it("should keep the list readable under a banner that says so", async () => {
      await renderLibrary(readable);

      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("Showing your recipes from this session. Changes need a connection."),
      ).toBeOnTheScreen();
      expect(openButtons()).toHaveLength(5);
    });

    it("should open a recipe all the same", async () => {
      await renderLibrary(readable);

      await user().press(screen.getByRole("button", { name: /^Beef chilli,/ }));

      expect(onOpenRecipe).toHaveBeenCalledTimes(1);
      expect(onOpenRecipe).toHaveBeenCalledWith(sampleRecipes[0]?.id);
    });

    it("should dim New recipe and stop it responding", async () => {
      await renderLibrary(readable);

      const button = screen.getByRole("button", { name: "New recipe" });
      expect(button).toBeDisabled();
      await user().press(button);

      expect(onNewRecipe).not.toHaveBeenCalled();
    });

    it("should still filter the list it has", async () => {
      await renderLibrary(readable);

      await user().type(field(), "chi");

      expect(openButtons()).toHaveLength(2);
    });

    it("should disable New recipe in the no-matches state too", async () => {
      await renderLibrary(readable);
      await user().type(field(), "pasta");

      for (const button of newRecipeButtons()) {
        expect(button).toBeDisabled();
      }
    });
  });

  describe("online", () => {
    it("should show no banner", async () => {
      await renderLibrary();

      expect(screen.queryByText("You're offline")).not.toBeOnTheScreen();
    });
  });

  describe("in the light theme", () => {
    it("should draw the same screen", async () => {
      await renderLibrary(ready, "light");

      expect(openButtons()).toHaveLength(5);
    });
  });
});
