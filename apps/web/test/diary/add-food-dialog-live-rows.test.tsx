import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noPlateHooks } from "./noPlateHooks";
import { noFavouriteHooks } from "../favourites/noFavouriteHooks";
import { makeFood, makeOffCandidate, makePortion, makeSearchHit } from "../foods/support";

import type { UseFoodSearchOptions, FoodSearchResult } from "@keylow/api-client";
import type { Food, FoodPortion, OffCandidate } from "@keylow/core/schemas";

import { AddFoodDialog, SearchStep } from "@/components/diary/AddFoodDialog";
import { ToastProvider } from "@/components/ui/Toast";

// The errors are the real ones: the mock below would otherwise load before the helpers it spreads.
const { OffProductNotFoundError, RateLimitedError } =
  await vi.importActual<typeof import("@keylow/api-client")>("@keylow/api-client");

const RICE_ID = "11111111-1111-4111-8111-222222222222";
const SAVED_ID = "11111111-1111-4111-8111-999999999999";
const BURGER_CODE = "5000159484695";
const WRAP_CODE = "5000159484701";

const rice = makeFood({ id: RICE_ID, name: "Basmati rice, boiled", source: "cofid", kcal: 120 });

const burger = makeOffCandidate({
  code: BURGER_CODE,
  name: "Chicken Burger",
  brand: "Northfield",
  kcal: 200,
  protein_g: 20,
  carbs_g: 10,
  fat_g: 8,
  default_portion: { label: "1 burger", grams: 120, ml: null },
});
// A candidate with no portion is drawn per 100 g, as the phone draws it.
const wrap = makeOffCandidate({
  code: WRAP_CODE,
  name: "Chicken Wrap",
  brand: "Northfield",
  default_portion: null,
});

const savedBurger = makeFood({
  id: SAVED_ID,
  name: "Chicken Burger",
  brand: "Northfield",
  source: "off",
  kcal: 200,
  protein_g: 20,
  carbs_g: 10,
  fat_g: 8,
});
const burgerPortion = makePortion({
  food_id: SAVED_ID,
  label: "1 burger",
  grams: 120,
  is_default: true,
});

type MaterialiseOptions = { onSuccess: (food: Food) => void; onError: () => void };

type Api = {
  searchOptions: Array<UseFoodSearchOptions | undefined>;
  local: FoodSearchResult["local"];
  off: OffCandidate[];
  isLoadingOff: boolean;
  offError: FoodSearchResult["offError"];
  materialiseError: Error | null;
  materialise: ReturnType<
    typeof vi.fn<(variables: { code: string }, options: MaterialiseOptions) => void>
  >;
  foods: Map<string, Food>;
  portions: Map<string, FoodPortion[]>;
};

const api = vi.hoisted((): Api => ({
  searchOptions: [],
  local: [],
  off: [],
  isLoadingOff: false,
  offError: null,
  materialiseError: null,
  materialise: undefined as never,
  foods: new Map(),
  portions: new Map(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  ...noFavouriteHooks,
  ...noPlateHooks,
  useRefreshOutdatedOffFood: () => undefined,
  useRecentFoods: () => ({ data: [], isError: false, fetchStatus: "idle" }),
  useProfileTimeZone: () => ({ data: "UTC" }),
  useFoodSearch: (query: string, options?: UseFoodSearchOptions): FoodSearchResult => {
    api.searchOptions.push(options);
    const isTyped = query.trim().length >= 2;

    return {
      local: isTyped ? api.local : [],
      off: isTyped ? api.off : [],
      isLoadingLocal: false,
      isLoadingOff: api.isLoadingOff,
      isDebouncing: false,
      offError: api.offError,
      localError: null,
    };
  },
  useMaterialiseOffProduct: () => ({
    mutate: api.materialise,
    isPending: false,
    error: api.materialiseError,
    variables: undefined,
  }),
  useRecipeSearch: () => ({ recipes: [], isLoading: false, isDebouncing: false, error: null }),
  useFoodWithPortions: (id: string) => {
    const food = api.foods.get(id);
    return food === undefined
      ? { status: "notFound" }
      : { status: "ready", food, portions: api.portions.get(id) ?? [] };
  },
  useLogPlateEntries: () => ({ mutateAsync: () => Promise.resolve([]) }),
  useQuickAdd: () => ({ mutateAsync: () => Promise.resolve({}) }),
  useSupabase: () => ({}),
}));

// The list pushes a food's page when nothing says where to open it, so the router has to be there.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function renderDialog() {
  render(
    <ToastProvider>
      <AddFoodDialog request={{ date: "2026-10-15" }} opener={null} onClose={vi.fn<() => void>()} />
    </ToastProvider>,
  );
}

function search(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: text },
  });
}

const liveGroup = () => screen.getByRole("region", { name: "From Open Food Facts" });
const burgerRow = () => within(liveGroup()).getByRole("button", { name: /^Chicken\s*Burger/ });
const wrapRow = () => within(liveGroup()).getByRole("button", { name: /^Chicken\s*Wrap/ });

function saveSucceeds() {
  api.materialise.mockImplementation((_variables, options) => {
    options.onSuccess(savedBurger);
  });
}

beforeEach(() => {
  api.searchOptions = [];
  api.local = [];
  api.off = [burger, wrap];
  api.isLoadingOff = false;
  api.offError = null;
  api.materialiseError = null;
  api.materialise = vi.fn();
  api.foods = new Map([
    [RICE_ID, rice],
    [SAVED_ID, savedBurger],
  ]);
  api.portions = new Map([[SAVED_ID, [burgerPortion]]]);
});

afterEach(cleanup);

describe("the add food dialog's live Open Food Facts rows", () => {
  it("should ask for up to 50 matches", () => {
    renderDialog();

    search("chicken");

    expect(api.searchOptions.at(-1)).toEqual({ limit: 50 });
  });

  it("should show the live group when no stored food matches, in place of No foods found", () => {
    renderDialog();

    search("chicken");

    expect(liveGroup()).toBeTruthy();
    expect(screen.queryByText("No foods found")).toBeNull();
  });

  it("should show the serving a live row opens on, with its values, and no plus", () => {
    renderDialog();

    search("chicken");

    expect(within(burgerRow()).getByText("1 burger (120 g)")).toBeTruthy();
    expect(within(burgerRow()).getByText("240")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Add Chicken Burger/ })).toBeNull();
  });

  it("should keep a live row with no serving to show per 100 g, and say so in the note", () => {
    renderDialog();

    search("chicken");

    expect(within(wrapRow()).queryByText(/^1 /)).toBeNull();
    expect(
      screen.getByText(
        "Values per 100 g unless marked, and servings are confirmed when you open a product",
      ),
    ).toBeTruthy();
  });

  it("should say only that servings are confirmed when every live row shows one", () => {
    api.off = [burger];
    renderDialog();

    search("chicken");

    expect(screen.getByText("Servings are confirmed when you open a product")).toBeTruthy();
  });

  it("should save the product once and open its amount step when a live row is pressed", () => {
    saveSucceeds();
    renderDialog();
    search("chicken");

    fireEvent.click(burgerRow());

    expect(api.materialise).toHaveBeenCalledTimes(1);
    expect(api.materialise).toHaveBeenCalledWith({ code: BURGER_CODE }, expect.anything());
    expect(screen.getByRole("button", { name: "Add to plate" })).toBeTruthy();
  });

  it("should save once on a double press, and hold the other rows while it saves", () => {
    renderDialog();
    search("chicken");

    fireEvent.click(burgerRow());
    fireEvent.click(burgerRow());
    fireEvent.click(wrapRow());

    expect(api.materialise).toHaveBeenCalledTimes(1);
  });

  it("should put the saved product on the plate from its amount step, beside food already there", () => {
    api.local = [
      makeSearchHit({ id: RICE_ID, name: "Basmati rice, boiled", source: "cofid", kcal: 120 }),
    ];
    saveSucceeds();
    renderDialog();
    search("rice");
    fireEvent.click(screen.getByRole("button", { name: /^Add Basmati rice, boiled/ }));
    expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
    search("chicken");

    fireEvent.click(burgerRow());
    fireEvent.click(screen.getByRole("button", { name: "Add to plate" }));

    expect(screen.getByRole("button", { name: "Your plate, 2 foods" })).toBeTruthy();
  });

  it("should keep the plate and stay on the search when the product cannot be saved", () => {
    api.local = [
      makeSearchHit({ id: RICE_ID, name: "Basmati rice, boiled", source: "cofid", kcal: 120 }),
    ];
    api.materialiseError = new Error("Failed");
    api.materialise.mockImplementation((_variables, options) => {
      options.onError();
    });
    renderDialog();
    search("rice");
    fireEvent.click(screen.getByRole("button", { name: /^Add Basmati rice, boiled/ }));
    search("chicken");

    fireEvent.click(burgerRow());

    expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
    expect(within(liveGroup()).getByText("This product could not be added")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add to plate" })).toBeNull();
  });

  it("should say when to try again when saving was rate limited", () => {
    api.materialiseError = new RateLimitedError("slow", 30, undefined);
    renderDialog();

    search("chicken");

    expect(within(liveGroup()).getByRole("alert").textContent).toContain("30");
  });

  it("should say Open Food Facts no longer has a product that has vanished", () => {
    api.materialiseError = new OffProductNotFoundError(WRAP_CODE);
    renderDialog();

    search("chicken");

    expect(within(liveGroup()).getByRole("alert")).toBeTruthy();
  });
});

describe("the add food dialog's search with many matches", () => {
  it("should reach all 50 matches by pressing See more on each group", () => {
    const many = (source: "cofid" | "off", count: number) =>
      Array.from({ length: count }, (_, index) =>
        makeSearchHit({ id: `${source}-${index}`, name: `Chicken ${source} ${index}`, source }),
      );
    api.local = [...many("cofid", 25), ...many("off", 25)];
    api.off = [];
    renderDialog();
    search("chicken");
    const rows = () => screen.getAllByRole("button", { name: /^Add Chicken/ });
    expect(rows()).toHaveLength(10);

    fireEvent.click(screen.getByRole("button", { name: "See 20 more in Common foods" }));
    fireEvent.click(screen.getByRole("button", { name: "See 20 more in Branded foods" }));

    expect(rows()).toHaveLength(50);
  });
});

describe("Add ingredient's search, which shares the step", () => {
  function renderIngredientSearch() {
    const onOpenFood = vi.fn<(foodId: string) => void>();
    render(
      <SearchStep
        mode="ingredient"
        query="chicken"
        onQueryChange={vi.fn()}
        onOpenFood={onOpenFood}
        onOpenRecent={vi.fn()}
      />,
    );

    return { onOpenFood };
  }

  it("should list the live rows with their servings, and no plus", () => {
    renderIngredientSearch();

    expect(within(burgerRow()).getByText("1 burger (120 g)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Add Chicken Burger/ })).toBeNull();
  });

  it("should save the product once and open its amount step when a live row is pressed", () => {
    saveSucceeds();
    const { onOpenFood } = renderIngredientSearch();

    fireEvent.click(burgerRow());

    expect(api.materialise).toHaveBeenCalledTimes(1);
    expect(onOpenFood).toHaveBeenCalledWith(SAVED_ID);
  });
});

describe("the add food dialog while Open Food Facts is searched", () => {
  it("should say it is being searched, and not say No foods found yet, when nothing else was found", () => {
    api.off = [];
    api.isLoadingOff = true;
    renderDialog();

    search("chicken");

    expect(screen.getByText("Searching Open Food Facts")).toBeTruthy();
    expect(screen.queryByText("No foods found")).toBeNull();
  });

  it("should say so, and still say No foods found, when it could not be searched and nothing was found", () => {
    api.off = [];
    api.offError = { kind: "failed", debugMessage: "RAW" };
    renderDialog();

    search("chicken");

    expect(screen.getByText("Open Food Facts could not be searched right now")).toBeTruthy();
    expect(screen.getByText("No foods found")).toBeTruthy();
  });

  it("should keep the stored results when it could not be searched", () => {
    api.local = [makeSearchHit({ id: RICE_ID, name: "Basmati rice, boiled", source: "cofid" })];
    api.off = [];
    api.offError = { kind: "failed", debugMessage: "RAW" };
    renderDialog();

    search("rice");

    expect(screen.getByRole("button", { name: /^Add Basmati rice, boiled/ })).toBeTruthy();
    expect(screen.getByText("Open Food Facts could not be searched right now")).toBeTruthy();
  });
});
