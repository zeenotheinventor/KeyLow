import { PALATE_WORDS, RETRY_LABEL, SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { act, render, screen, userEvent, within } from "@testing-library/react-native";

import PalateRoute from "../app/(tabs)/more/assistant/palate";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { PalateFood, PalatePreference } from "@keylow/core";

type MutationOptions = { onError?: () => void };
type Query<Data> = { data: Data | undefined; isError: boolean; refetch: jest.Mock<undefined, []> };

const FIRST_DAY = "2026-10-20";
const APPLES_ID = "11111111-1111-4111-8111-111111111111";
const EGGS_ID = "11111111-1111-4111-8111-111111111112";
const STEW_ID = "22222222-2222-4222-8222-222222222221";
const CORRECTION_ID = "44444444-4444-4444-8444-444444444441";

const APPLES = "Apples, eating, raw, flesh and skin";
const EGGS = "Eggs, chicken, whole, boiled";

const food = (id: string, name: string, foodGroup: string): PalateFood => ({
  id,
  name,
  source: "cofid",
  food_group: foodGroup,
});

const statRow = (id: { foodId: string } | { recipeId: string }, days: number, grams: number) => ({
  foodId: "foodId" in id ? id.foodId : null,
  recipeId: "recipeId" in id ? id.recipeId : null,
  entryCount: days,
  distinctDays: days,
  firstLocalDate: FIRST_DAY,
  lastLocalDate: "2026-11-12",
  medianResolvedGrams: grams,
  beforeElevenCount: days,
  elevenToSixteenCount: 0,
  sixteenOrLaterCount: 0,
});

const preference = (
  id: string,
  kind: PalatePreference["kind"],
  reference: { foodId?: string; recipeId?: string; label?: string },
): PalatePreference => ({
  id,
  kind,
  foodId: reference.foodId ?? null,
  recipeId: reference.recipeId ?? null,
  label: reference.label ?? null,
});

const AVOID_LIST = [
  preference("p-peanuts", "allergy", { label: "peanuts" }),
  preference("p-mushrooms", "dislike", { label: "mushrooms" }),
];

const mockPalate: {
  stats: Query<ReturnType<typeof statRow>[]>;
  loggedDays: Query<number>;
  preferences: Query<PalatePreference[]>;
  foods: Query<PalateFood[]>;
  recipesOptions: object | undefined;
  recipes: Query<{ id: string; name: string; servings: number; yield_grams: number | null }[]>;
  setNotUsual: { mutate: jest.Mock<undefined, [object]> };
  remove: { mutate: jest.Mock<undefined, [string]> };
  // What the screen asked of the two write hooks, so a test can fail a write.
  setNotUsualOptions: MutationOptions | undefined;
  removeOptions: MutationOptions | undefined;
} = {
  stats: { data: [], isError: false, refetch: jest.fn<undefined, []>() },
  loggedDays: { data: 0, isError: false, refetch: jest.fn<undefined, []>() },
  preferences: { data: [], isError: false, refetch: jest.fn<undefined, []>() },
  foods: { data: [], isError: false, refetch: jest.fn<undefined, []>() },
  recipesOptions: undefined,
  recipes: { data: [], isError: false, refetch: jest.fn<undefined, []>() },
  setNotUsual: { mutate: jest.fn<undefined, [object]>() },
  remove: { mutate: jest.fn<undefined, [string]>() },
  setNotUsualOptions: undefined,
  removeOptions: undefined,
};

// The hooks are tested where they live, in `@keylow/api-client`.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  usePalateStats: () => mockPalate.stats,
  usePalateLoggedDays: () => mockPalate.loggedDays,
  usePalatePreferences: () => mockPalate.preferences,
  usePalateFoods: () => mockPalate.foods,
  useRecipes: (options: object) => {
    mockPalate.recipesOptions = options;
    return mockPalate.recipes;
  },
  useProfileTimeZone: () => ({ data: "Europe/London", isError: false, refetch: jest.fn() }),
  useSetNotUsual: (options: MutationOptions) => {
    mockPalate.setNotUsualOptions = options;
    return mockPalate.setNotUsual;
  },
  useRemovePalatePreference: (options: MutationOptions) => {
    mockPalate.removeOptions = options;
    return mockPalate.remove;
  },
}));
jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-11-13T12:00:00Z") }));
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

// Ten logged days with apples, eggs and a stew on all of them, two more foods on fewer, and an avoid list.
function givenADiary({ extraFoods = 0 }: { extraFoods?: number } = {}) {
  const extra = Array.from({ length: extraFoods }, (_, index) => ({
    id: `11111111-1111-4111-8111-1111111111${String(20 + index)}`,
    name: `Extra food ${String(index + 1)}`,
  }));
  mockPalate.foods.data = [
    food(APPLES_ID, APPLES, "FA"),
    food(EGGS_ID, EGGS, "CA"),
    ...extra.map(({ id, name }) => food(id, name, "FA")),
  ];
  mockPalate.stats.data = [
    statRow({ foodId: APPLES_ID }, 10, 100),
    statRow({ foodId: EGGS_ID }, 9, 110),
    ...extra.map(({ id }) => statRow({ foodId: id }, 5, 50)),
    statRow({ recipeId: STEW_ID }, 6, 400),
  ];
  mockPalate.recipes.data = [{ id: STEW_ID, name: "Stew", servings: 1, yield_grams: 400 }];
  mockPalate.loggedDays.data = 10;
  mockPalate.preferences.data = AVOID_LIST;
}

async function renderPalate() {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>
        <PalateRoute />
      </ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the What you usually eat screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/PalateScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockPalate.stats = { data: [], isError: false, refetch: jest.fn<undefined, []>() };
    mockPalate.loggedDays = { data: 0, isError: false, refetch: jest.fn<undefined, []>() };
    mockPalate.preferences = { data: [], isError: false, refetch: jest.fn<undefined, []>() };
    mockPalate.foods = { data: [], isError: false, refetch: jest.fn<undefined, []>() };
    mockPalate.recipes = { data: [], isError: false, refetch: jest.fn<undefined, []>() };
    mockPalate.setNotUsual = { mutate: jest.fn<undefined, [object]>() };
    mockPalate.remove = { mutate: jest.fn<undefined, [string]>() };
    givenADiary();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("with a diary to go on, as kitchen · palate draws it", () => {
    it("should be headed What you usually eat, with Back to Assistant", async () => {
      const user = await renderPalate();

      expect(screen.getByRole("heading", { name: PALATE_WORDS.title })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: PALATE_WORDS.back }));
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should open with the summary lines and the caption", async () => {
      await renderPalate();

      expect(screen.getByText("You eat apples and eggs on most days.")).toBeOnTheScreen();
      expect(screen.getByText("You avoid peanuts (allergy) and mushrooms.")).toBeOnTheScreen();
      expect(screen.getByText(PALATE_WORDS.caption)).toBeOnTheScreen();
    });

    it("should draw each group as a list, named for its title", async () => {
      await renderPalate();

      // A kit card of rows is a list by `role`, but it is not an accessible element, so `getByRole` cannot see it.
      expect(screen.getByLabelText("Usual foods")).toHaveProp("role", "list");
    });

    it("should group the rest under the board's titles", async () => {
      await renderPalate();

      for (const title of [
        "Usual foods",
        "Usual recipes",
        "By time of day",
        "Rarely or never",
        "Foods you avoid",
      ]) {
        expect(screen.getByRole("heading", { name: title })).toBeOnTheScreen();
      }
    });

    it("should list a usual food with its days and typical grams", async () => {
      await renderPalate();

      const foods = within(screen.getByLabelText("Usual foods"));
      expect(foods.getByText(APPLES)).toBeOnTheScreen();
      expect(foods.getByText("10 days · usually 100 g")).toBeOnTheScreen();
    });

    it("should list a usual recipe with its servings", async () => {
      await renderPalate();

      const recipes = within(screen.getByLabelText("Usual recipes"));
      expect(recipes.getByText("Stew")).toBeOnTheScreen();
      expect(recipes.getByText("6 days · usually 1 serving")).toBeOnTheScreen();
    });

    it("should name the foods of the morning, and leave out a time of day with none", async () => {
      await renderPalate();

      const times = within(screen.getByLabelText("By time of day"));
      expect(times.getByText("Morning")).toBeOnTheScreen();
      expect(times.getByText("Apples and eggs")).toBeOnTheScreen();
      expect(times.queryByText("Midday")).not.toBeOnTheScreen();
    });

    it("should list the avoid list with each kind as a badge, and link to Foods to avoid", async () => {
      const user = await renderPalate();

      const avoid = within(screen.getByLabelText("Foods you avoid"));
      expect(avoid.getByText("Allergy")).toBeOnTheScreen();
      expect(avoid.getByText("Dislike")).toBeOnTheScreen();
      expect(screen.getByText(PALATE_WORDS.avoidCaption)).toBeOnTheScreen();
      await user.press(avoid.getByRole("link", { name: /Foods to avoid/ }));
      expect(routerMock.push).toHaveBeenCalledWith("/more/assistant/foods-to-avoid");
    });

    it("should give Not true to foods, recipes and rare groups, but not to a time of day or an avoided food", async () => {
      await renderPalate();

      expect(screen.getByRole("button", { name: `Not true: ${APPLES}` })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Not true: Stew" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Not true: Drinks" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /Not true: Morning/ })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /Not true: Peanuts/i })).not.toBeOnTheScreen();
    });
  });

  describe("Show all", () => {
    beforeEach(() => {
      givenADiary({ extraFoods: 6 });
    });

    it("should show six foods and open the rest in place", async () => {
      const user = await renderPalate();
      const foods = within(screen.getByLabelText("Usual foods"));

      expect(foods.getAllByRole("button", { name: /^Not true: / })).toHaveLength(6);
      await user.press(foods.getByRole("button", { name: "Show all 8" }));

      expect(foods.getAllByRole("button", { name: /^Not true: / })).toHaveLength(8);
      expect(foods.queryByRole("button", { name: "Show all 8" })).not.toBeOnTheScreen();
    });
  });

  describe("reading the recipes", () => {
    it("should read the archived recipes too, because an old entry may point at one", async () => {
      await renderPalate();

      expect(mockPalate.recipesOptions).toEqual({ archived: true, enabled: true });
    });
  });

  describe("saying Not true", () => {
    it("should send the same target for the same item pressed twice, which the database swallows", async () => {
      const user = await renderPalate();

      await user.press(screen.getByRole("button", { name: `Not true: ${EGGS}` }));
      await user.press(screen.getByRole("button", { name: `Not true: ${EGGS}` }));

      expect(mockPalate.setNotUsual.mutate).toHaveBeenCalledTimes(2);
      expect(mockPalate.setNotUsual.mutate.mock.calls[1]?.[0]).toEqual({ foodId: EGGS_ID });
    });

    it("should write the correction for a food by its id", async () => {
      const user = await renderPalate();

      await user.press(screen.getByRole("button", { name: `Not true: ${EGGS}` }));

      expect(mockPalate.setNotUsual.mutate).toHaveBeenCalledTimes(1);
      expect(mockPalate.setNotUsual.mutate.mock.calls[0]?.[0]).toEqual({ foodId: EGGS_ID });
    });

    it("should write the correction for a recipe by its id", async () => {
      const user = await renderPalate();

      await user.press(screen.getByRole("button", { name: "Not true: Stew" }));

      expect(mockPalate.setNotUsual.mutate.mock.calls[0]?.[0]).toEqual({ recipeId: STEW_ID });
    });

    it("should write the correction for a rare group by its label", async () => {
      const user = await renderPalate();

      await user.press(screen.getByRole("button", { name: "Not true: Drinks" }));

      expect(mockPalate.setNotUsual.mutate.mock.calls[0]?.[0]).toEqual({ label: "drinks" });
    });

    it("should say Not saved in a toast without the food's name when the write fails", async () => {
      const user = await renderPalate();
      await user.press(screen.getByRole("button", { name: `Not true: ${EGGS}` }));

      await act(() => {
        mockPalate.setNotUsualOptions?.onError?.();
      });

      // The toast is a sentence with no food in it, so its words are the whole of what is said.
      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeOnTheScreen();
      expect(SAVE_FAILED_BANNER).not.toMatch(/egg/i);
    });
  });

  describe("with a correction, as kitchen · palate-corrected draws it", () => {
    beforeEach(() => {
      mockPalate.preferences.data = [
        ...AVOID_LIST,
        preference(CORRECTION_ID, "not_usual", { foodId: EGGS_ID }),
      ];
    });

    it("should keep the corrected food in its place, saying so, with Undo in place of Not true", async () => {
      await renderPalate();

      const foods = within(screen.getByLabelText("Usual foods"));
      expect(foods.getByText(EGGS)).toBeOnTheScreen();
      expect(foods.getByText(PALATE_WORDS.correctedDetail)).toBeOnTheScreen();
      expect(foods.getByRole("button", { name: `Undo, ${EGGS}` })).toBeOnTheScreen();
      expect(foods.queryByRole("button", { name: `Not true: ${EGGS}` })).not.toBeOnTheScreen();
    });

    it("should rebuild the summary without the corrected food", async () => {
      await renderPalate();

      expect(screen.getByText("You eat apples on most days.")).toBeOnTheScreen();
    });

    it("should remove the correction by its id when Undo is pressed", async () => {
      const user = await renderPalate();

      await user.press(screen.getByRole("button", { name: `Undo, ${EGGS}` }));

      expect(mockPalate.remove.mutate).toHaveBeenCalledTimes(1);
      expect(mockPalate.remove.mutate.mock.calls[0]?.[0]).toBe(CORRECTION_ID);
    });

    it("should say Not saved in a toast when Undo fails", async () => {
      const user = await renderPalate();
      await user.press(screen.getByRole("button", { name: `Undo, ${EGGS}` }));

      await act(() => {
        mockPalate.removeOptions?.onError?.();
      });

      expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeOnTheScreen();
    });
  });

  describe("with a corrected recipe and a corrected group that is not the last", () => {
    const RECIPE_CORRECTION_ID = "44444444-4444-4444-8444-444444444442";
    const GROUP_CORRECTION_ID = "44444444-4444-4444-8444-444444444443";

    beforeEach(() => {
      mockPalate.preferences.data = [
        ...AVOID_LIST,
        preference(RECIPE_CORRECTION_ID, "not_usual", { recipeId: STEW_ID }),
        preference(GROUP_CORRECTION_ID, "not_usual", { label: "legumes and nuts" }),
      ];
    });

    it("should keep the recipe in its card, corrected, with Undo", async () => {
      await renderPalate();

      const recipes = within(screen.getByLabelText("Usual recipes"));
      expect(recipes.getByText("Stew")).toBeOnTheScreen();
      expect(recipes.getByText(PALATE_WORDS.correctedDetail)).toBeOnTheScreen();
      expect(recipes.getByRole("button", { name: "Undo, Stew" })).toBeOnTheScreen();
    });

    it("should keep the group between the groups on either side of it, corrected, with Undo", async () => {
      await renderPalate();

      const rare = within(screen.getByLabelText("Rarely or never"));
      const buttons = rare.getAllByRole("button", { name: /^(Not true: |Undo, )/ });
      const place = buttons.indexOf(rare.getByRole("button", { name: "Undo, Legumes and nuts" }));
      expect(place).toBeGreaterThan(0);
      expect(place).toBeLessThan(buttons.length - 1);
    });

    it("should remove the recipe's correction by its id when Undo is pressed on it", async () => {
      const user = await renderPalate();

      await user.press(screen.getByRole("button", { name: "Undo, Stew" }));

      expect(mockPalate.remove.mutate.mock.calls[0]?.[0]).toBe(RECIPE_CORRECTION_ID);
    });

    it("should remove the group's correction by its id when Undo is pressed on it", async () => {
      const user = await renderPalate();

      await user.press(screen.getByRole("button", { name: "Undo, Legumes and nuts" }));

      expect(mockPalate.remove.mutate.mock.calls[0]?.[0]).toBe(GROUP_CORRECTION_ID);
    });
  });

  describe("with fewer than 4 logged days, as kitchen · palate-empty draws it", () => {
    beforeEach(() => {
      mockPalate.loggedDays.data = 2;
    });

    it("should say there is not enough to go on and count the days logged", async () => {
      await renderPalate();

      expect(screen.getByText(PALATE_WORDS.emptyTitle)).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Log your food on 4 days and this page shows what you usually eat. So far you have logged 2 days.",
        ),
      ).toBeOnTheScreen();
    });

    it("should draw no lists, and keep Foods you avoid", async () => {
      await renderPalate();

      expect(screen.queryByRole("heading", { name: "Usual foods" })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Not true: / })).not.toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Foods you avoid" })).toBeOnTheScreen();
      expect(screen.getByText("Peanuts")).toBeOnTheScreen();
    });

    it("should say None yet beside the link when nothing is avoided", async () => {
      mockPalate.preferences.data = [];
      await renderPalate();

      expect(screen.getByText(PALATE_WORDS.noneYet)).toBeOnTheScreen();
      expect(screen.getByText(PALATE_WORDS.noneYetCaption)).toBeOnTheScreen();
    });
  });

  describe("while loading", () => {
    it("should draw a loading status and no lists until everything is read", async () => {
      mockPalate.stats.data = undefined;
      await renderPalate();

      expect(screen.getByRole("status", { name: PALATE_WORDS.title })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: "Usual foods" })).not.toBeOnTheScreen();
    });
  });

  describe("when a read fails", () => {
    it("should draw an error state with Try again, which reads everything that failed again", async () => {
      mockPalate.stats = { data: undefined, isError: true, refetch: jest.fn<undefined, []>() };
      const user = await renderPalate();

      expect(screen.getByText(PALATE_WORDS.loadFailedTitle)).toBeOnTheScreen();
      expect(screen.getByText(PALATE_WORDS.loadFailedBody)).toBeOnTheScreen();
      await act(() => user.press(screen.getByRole("button", { name: RETRY_LABEL })));
      expect(mockPalate.stats.refetch).toHaveBeenCalledTimes(1);
    });

    it("should leave the screen as it is when a refresh fails behind what was read", async () => {
      mockPalate.preferences.isError = true;
      await renderPalate();

      expect(screen.getByRole("heading", { name: "Usual foods" })).toBeOnTheScreen();
      expect(screen.queryByText(PALATE_WORDS.loadFailedTitle)).not.toBeOnTheScreen();
    });
  });
});
