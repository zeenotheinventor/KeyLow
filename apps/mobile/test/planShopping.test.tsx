import { PLAN_SHOPPING_WORDS, SHOPPING_LIST } from "@keylow/core/copy";
import { planShoppingDraftsOf as mockPlanShoppingDraftsOf } from "@keylow/core/plans";
import { act, render, screen, userEvent, within } from "@testing-library/react-native";

import PlanRoute from "../app/plan";
import PlanAddToListRoute from "../app/plan/add-to-list";
import PlanDayRoute from "../app/plan/day/[date]";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type {
  MealPlan,
  ShoppingSourceRecipe,
  AddPlanToListInput,
  ShoppingPreviewState,
} from "@keylow/api-client";
import type { PlanShopping } from "@keylow/core/plans";

// The plan's way into the shopping list: the footer of the week, the button of a day, and the add screen for a
// plan (`plan · shopping-added`). The hooks that read and write are mocked, except that the preview is summed by
// core from the recipes and foods below, so what the screen shows is what core sums.

type AddCallbacks = { onSuccess?: () => void; onError?: () => void; onSettled?: () => void };

const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PORRIDGE_ID = "11111111-1111-4111-8111-111111111111";
const OATS_ID = "22222222-2222-4222-8222-222222222222";
const MILK_ID = "33333333-3333-4333-8333-333333333333";
const OIL_ID = "44444444-4444-4444-8444-444444444444";
const CHICKEN_ID = "55555555-5555-4555-8555-555555555555";

const mockApi: {
  plans: { data: MealPlan[] | undefined; isError: boolean; refetch: jest.Mock };
  isOnline: boolean;
  preview: { override: ShoppingPreviewState | null; shoppings: (PlanShopping | null)[] };
  add: {
    mutate: jest.Mock<undefined, [AddPlanToListInput, AddCallbacks]>;
    isPending: boolean;
  };
} = {
  plans: { data: [], isError: false, refetch: jest.fn() },
  isOnline: true,
  preview: { override: null, shoppings: [] },
  add: { mutate: jest.fn<undefined, [AddPlanToListInput, AddCallbacks]>(), isPending: false },
};

const mockPorridge: ShoppingSourceRecipe = {
  id: PORRIDGE_ID,
  name: "Eval porridge bowl",
  servings: 1,
  ingredients: [
    {
      foodId: OATS_ID,
      name: "Porridge oats, unfortified",
      food: { name: "Porridge oats, unfortified", food_group: "DC" },
      quantity: 50,
      unit: "g",
      resolvedGrams: 50,
      portionLabel: null,
    },
    {
      foodId: MILK_ID,
      name: "Milk, whole, pasteurised, average",
      food: { name: "Milk, whole, pasteurised, average", food_group: "DB" },
      quantity: 200,
      unit: "g",
      resolvedGrams: 200,
      portionLabel: null,
    },
  ],
};
const mockFoods = [
  { id: OATS_ID, name: "Porridge oats, unfortified", food_group: "DC" },
  { id: OIL_ID, name: "Oil, olive", food_group: "FA" },
  { id: CHICKEN_ID, name: "Chicken, breast, grilled without skin, meat only", food_group: "OA" },
];

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useMealPlans: () => mockApi.plans,
  useMealPlanRepeatLimit: () => ({ data: 3, isError: false, refetch: jest.fn() }),
  useTargets: () => ({ data: { kcal: 1300, protein_g: 90, carbs_g: 150, fat_g: 50 } }),
  useConfirmPlanDay: () => ({ mutate: jest.fn(), isPending: false }),
  useProfileTimeZone: () => ({ data: "Europe/London", isError: false, refetch: jest.fn() }),
  useAddPlanToList: () => mockApi.add,
  usePlanShoppingPreview: (shopping: PlanShopping | null): ShoppingPreviewState => {
    mockApi.preview.shoppings.push(shopping);
    if (mockApi.preview.override !== null) {
      return mockApi.preview.override;
    }
    return shopping === null
      ? { status: "loading" }
      : { status: "ready", preview: mockPlanShoppingDraftsOf(shopping, [mockPorridge], mockFoods) };
  },
}));
jest.mock("../components/AssistantSheetHost", () => ({ useOpenAssistant: () => jest.fn() }));
jest.mock("../lib/connectivity", () => ({ useIsOnline: () => mockApi.isOnline }));
jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-11-18T12:00:00Z") }));
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

const recipeItem = (id: string, extra = {}) => ({
  kind: "recipe" as const,
  id,
  position: 0,
  slotTime: "07:30:00",
  recipeId: PORRIDGE_ID,
  servings: 1,
  nutrients: { kcal: 389, protein_g: 13, carbs_g: 50, fat_g: 10 },
  leftoverOf: null,
  snapshot: { name: "Eval porridge bowl", servings: 1, effectiveGrams: 340 },
  ...extra,
});

const foodItem = (id: string, foodId: string, name: string, grams: number) => ({
  kind: "food" as const,
  id,
  position: 1,
  slotTime: "12:30:00",
  foodId,
  grams,
  portionId: null,
  nutrients: { kcal: 100, protein_g: 10, carbs_g: 20, fat_g: 5 },
  leftoverOf: null,
  snapshot: { name },
});

const planDay = (
  id: string,
  localDate: string,
  items: MealPlan["days"][number]["items"],
  confirmedAt: string | null = null,
): MealPlan["days"][number] => ({
  id,
  localDate,
  target: { kcal: 1300, protein_g: 90 },
  confirmedAt,
  confirmedEntryIds: confirmedAt === null ? null : ["e1"],
  items,
});

// Monday is confirmed. Wednesday cooks the porridge (50 g oats, 200 g milk) and plans chicken and olive oil.
// Thursday plans 30 g of oats and 10 g of oil on their own.
const livePlan = (): MealPlan => ({
  id: PLAN_ID,
  startDate: "2026-11-16",
  dayCount: 7,
  rules: {},
  source: "assistant",
  archivedAt: null,
  createdAt: "2026-11-13T10:00:00Z",
  days: [
    planDay(
      "d16",
      "2026-11-16",
      [foodItem("m", CHICKEN_ID, "Chicken, breast, grilled without skin, meat only", 999)],
      "2026-11-16T09:00:00Z",
    ),
    planDay("d18", "2026-11-18", [
      recipeItem("a18"),
      foodItem("b18", CHICKEN_ID, "Chicken, breast, grilled without skin, meat only", 130),
      foodItem("c18", OIL_ID, "Oil, olive", 5),
    ]),
    planDay("d19", "2026-11-19", [
      foodItem("a19", OATS_ID, "Porridge oats, unfortified", 30),
      foodItem("b19", OIL_ID, "Oil, olive", 10),
    ]),
  ],
});

async function renderRoute(element: React.ReactElement) {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>{element}</ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the plan's way into the shopping list", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/PlanScreen",
      "components/PlanDayScreen",
      "components/PlanAddToListScreen",
      "components/AddToListScreen",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockApi.plans = { data: [livePlan()], isError: false, refetch: jest.fn() };
    mockApi.isOnline = true;
    mockApi.preview = { override: null, shoppings: [] };
    mockApi.add = {
      mutate: jest.fn<undefined, [AddPlanToListInput, AddCallbacks]>(),
      isPending: false,
    };
  });

  describe("plan · week", () => {
    it("should offer Add to shopping list under the week, for the days of the week", async () => {
      const user = await renderRoute(<PlanRoute />);

      await user.press(screen.getByRole("button", { name: "Add to shopping list" }));

      expect(routerMock.push).toHaveBeenCalledWith(
        "/plan/add-to-list?start=2026-11-16&end=2026-11-22",
      );
    });

    it("should offer nothing to add when every planned day of the week is confirmed", async () => {
      const plan = livePlan();
      mockApi.plans = {
        data: [
          {
            ...plan,
            days: plan.days.map((day) => ({ ...day, confirmedAt: "2026-11-16T09:00:00Z" })),
          },
        ],
        isError: false,
        refetch: jest.fn(),
      };

      await renderRoute(<PlanRoute />);

      expect(screen.queryByRole("button", { name: "Add to shopping list" })).toBeNull();
    });
  });

  describe("plan · day", () => {
    it("should offer Add to shopping list for the day alone", async () => {
      routerMock.searchParams = { date: "2026-11-19" };
      const user = await renderRoute(<PlanDayRoute />);

      await user.press(screen.getByRole("button", { name: "Add to shopping list" }));

      expect(routerMock.push).toHaveBeenCalledWith(
        "/plan/add-to-list?start=2026-11-19&end=2026-11-19",
      );
    });

    it("should not offer it on a confirmed day", async () => {
      routerMock.searchParams = { date: "2026-11-16" };
      await renderRoute(<PlanDayRoute />);

      expect(screen.queryByRole("button", { name: "Add to shopping list" })).toBeNull();
    });

    it("should not offer it on a day with nothing planned", async () => {
      mockApi.plans = {
        data: [{ ...livePlan(), days: [planDay("d20", "2026-11-20", [])] }],
        isError: false,
        refetch: jest.fn(),
      };
      routerMock.searchParams = { date: "2026-11-20" };
      await renderRoute(<PlanDayRoute />);

      expect(screen.queryByRole("button", { name: "Add to shopping list" })).toBeNull();
    });

    it("should show the day as replanned once the plans are read again after the assistant wrote", async () => {
      routerMock.searchParams = { date: "2026-11-19" };
      const tree = () => (
        <ThemeProvider fixedPreference="dark">
          <ToastProvider>
            <PlanDayRoute />
          </ToastProvider>
        </ThemeProvider>
      );
      const { rerender } = await render(tree());
      expect(screen.getByText("Porridge oats, unfortified")).toBeOnTheScreen();

      const plan = livePlan();
      mockApi.plans = {
        data: [
          {
            ...plan,
            days: plan.days.map((day) =>
              day.id === "d19"
                ? { ...day, items: [foodItem("r19", CHICKEN_ID, "Eggs, boiled", 200)] }
                : day,
            ),
          },
        ],
        isError: false,
        refetch: jest.fn(),
      };
      await rerender(tree());

      expect(screen.getByText("Eggs, boiled")).toBeOnTheScreen();
      expect(screen.queryByText("Porridge oats, unfortified")).toBeNull();
      expect(screen.getByRole("button", { name: "Regenerate day" })).toBeOnTheScreen();
    });
  });

  describe("plan · shopping-added", () => {
    const renderAdd = (start = "2026-11-16", end = "2026-11-22") => {
      routerMock.searchParams = { start, end };
      return renderRoute(<PlanAddToListRoute />);
    };

    it("should be titled Add to shopping list for the first to the last day not yet confirmed, and say what is counted", async () => {
      await renderAdd();

      expect(screen.getByRole("heading", { name: "Add to shopping list" })).toBeOnTheScreen();
      expect(screen.getByText("Meal plan · Wed 18 to Thu 19 Nov")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "The days not yet confirmed. A recipe is bought once for the servings it makes, so leftovers are not bought twice.",
        ),
      ).toBeOnTheScreen();
    });

    it("should name the one day when it is opened from a day", async () => {
      await renderAdd("2026-11-18", "2026-11-18");

      expect(screen.getByText("Meal plan · Wed 18 Nov")).toBeOnTheScreen();
    });

    it("should list what to buy with core's sums and the recipe an amount came from, and set the staple aside", async () => {
      await renderAdd();

      const toBuy = screen.getByLabelText("To buy");
      // 50 g of oats in the porridge and 30 g planned on Thursday. Monday is confirmed, so its 999 g is not bought.
      expect(within(toBuy).getByText("Porridge oats, unfortified")).toBeOnTheScreen();
      expect(within(toBuy).getByText("80 g · From Eval porridge bowl")).toBeOnTheScreen();
      expect(within(toBuy).getByText("200 g · From Eval porridge bowl")).toBeOnTheScreen();
      expect(within(toBuy).getByText("130 g")).toBeOnTheScreen();
      const leftOut = screen.getByLabelText("Store cupboard items left out");
      expect(within(leftOut).getByText("Oil, olive")).toBeOnTheScreen();
      expect(within(leftOut).getByText("15 g")).toBeOnTheScreen();
    });

    it("should sum the days of one day alone", async () => {
      await renderAdd("2026-11-19", "2026-11-19");

      const toBuy = screen.getByLabelText("To buy");
      expect(within(toBuy).getByText("30 g")).toBeOnTheScreen();
      expect(within(toBuy).queryByText("Eval porridge bowl")).toBeNull();
    });

    it("should add the days with the staples chosen, then go back with the shopping list's toast", async () => {
      const user = await renderAdd();

      await user.press(screen.getByRole("checkbox", { name: "Add anyway: Oil, olive" }));
      await user.press(screen.getByRole("button", { name: "Add" }));

      expect(mockApi.add.mutate).toHaveBeenCalledTimes(1);
      const [variables, callbacks] = mockApi.add.mutate.mock.calls[0] ?? [];
      expect(variables?.addAnyway).toEqual([OIL_ID]);
      expect(variables?.shopping.firstDate).toBe("2026-11-18");
      expect(variables?.shopping.lastDate).toBe("2026-11-19");
      await act(() => {
        callbacks?.onSuccess?.();
      });
      expect(await screen.findByText(SHOPPING_LIST.added)).toBeOnTheScreen();
      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should say so in a toast and stay when the add fails, naming nothing of the plan", async () => {
      const user = await renderAdd();
      await user.press(screen.getByRole("button", { name: "Add" }));
      const [, callbacks] = mockApi.add.mutate.mock.calls[0] ?? [];

      await act(() => {
        callbacks?.onError?.();
      });

      expect(await screen.findByText(SHOPPING_LIST.addFailed)).toBeOnTheScreen();
      expect(routerMock.back).not.toHaveBeenCalled();
    });

    it("should write once when Add is pressed twice before the first write settles", async () => {
      // The mocked write never settles and never reports pending, so only the screen's own guard can stop a second.
      const user = await renderAdd();
      const add = screen.getByRole("button", { name: "Add" });

      await user.press(add);
      await user.press(add);

      expect(mockApi.add.mutate).toHaveBeenCalledTimes(1);
    });

    it("should let Add be pressed again once the first write failed", async () => {
      mockApi.add.mutate.mockImplementation((_input, callbacks) => {
        callbacks.onError?.();
        callbacks.onSettled?.();
      });
      const user = await renderAdd();
      const add = screen.getByRole("button", { name: "Add" });

      await user.press(add);
      await user.press(add);

      expect(mockApi.add.mutate).toHaveBeenCalledTimes(2);
    });

    it("should not add while offline, and say so", async () => {
      mockApi.isOnline = false;
      await renderAdd();

      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
      expect(screen.getByText(SHOPPING_LIST.offlineBody)).toBeOnTheScreen();
    });

    it("should go back from Cancel without adding", async () => {
      const user = await renderAdd();

      await user.press(screen.getByRole("button", { name: "Cancel" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
      expect(mockApi.add.mutate).not.toHaveBeenCalled();
    });

    it("should offer Try again when what the days need could not be read", async () => {
      const retry = jest.fn();
      mockApi.preview.override = { status: "error", debugMessage: "XX000", retry };
      const user = await renderAdd();

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(retry).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    });

    it("should say the plan could not be loaded, with Try again", async () => {
      mockApi.plans = { data: undefined, isError: true, refetch: jest.fn() };
      const user = await renderAdd();

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(mockApi.plans.refetch).toHaveBeenCalledTimes(1);
    });

    it("should say the days are not in the plan for an address that is not two days", async () => {
      await renderAdd("soon", "later");

      expect(screen.getByText("That day is not in your meal plan")).toBeOnTheScreen();
    });

    it("should say there is nothing to buy, without the scope line, when every day in the address is confirmed", async () => {
      await renderAdd("2026-11-16", "2026-11-16");

      expect(screen.getByText(PLAN_SHOPPING_WORDS.nothingToBuy)).toBeOnTheScreen();
      expect(screen.queryByText(PLAN_SHOPPING_WORDS.scopeLine)).toBeNull();

      expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
      expect(mockApi.preview.shoppings.every((shopping) => shopping === null)).toBe(true);
    });
  });
});
