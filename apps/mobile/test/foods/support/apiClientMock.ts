import { TERMS_VERSION } from "@keylow/core/copy";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";

import type * as ApiClient from "@keylow/api-client";
import type {
  CreatedFood,
  FoodWithPortionsState,
  LogEntry,
  LogFoodInput,
  LogRecipeInput,
  RecentFood,
  RecipeLogEntry,
  RecipeState,
} from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

type QueryState<Data> = { data: Data | undefined; isPending: boolean; isError: boolean };

export const savedFoodId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";

export const foodFixture: Food = buildFood({
  id: savedFoodId,
  owner_id: ownerId,
  name: "Oat bar",
  brand: "Acme",
  barcode: "5012345678900",
  kcal: 420,
  protein_g: 8.5,
  fat_g: 14,
  carbs_g: 62,
  fibre_g: 6.5,
  created_at: "2026-10-07T09:00:00Z",
});

export const portionFixtures: FoodPortion[] = [
  buildFoodPortion({
    id: "33333333-3333-4333-8333-333333333333",
    food_id: savedFoodId,
    owner_id: ownerId,
    label: "1 bar",
    grams: 45,
    is_default: true,
    position: 0,
    created_at: "2026-10-07T09:00:00Z",
  }),
  buildFoodPortion({
    id: "44444444-4444-4444-8444-444444444444",
    food_id: savedFoodId,
    owner_id: ownerId,
    label: "Box of 6",
    grams: 270,
    position: 1,
    created_at: "2026-10-07T09:00:00Z",
  }),
];

export const mockCreateFood = jest.fn<Promise<CreatedFood>, [unknown]>();
export const mockUpdateFood = jest.fn<Promise<Food>, [{ id: string; input: unknown }]>();
// What logging a food resolves to is not read by the screens, so a test only looks at what it was called with.
export const mockLogFood = jest.fn<Promise<unknown>, [LogFoodInput]>();
// Logging a serving of a recipe resolves to the stored row, whose id Undo removes.
export const mockLogRecipe = jest.fn<Promise<RecipeLogEntry>, [LogRecipeInput]>();
// The profile's time zone, which the picker reads the time in. A test changes `profileTimeZone` for a case.
export const profileTimeZone: { current: QueryState<string | null> } = {
  current: { data: "Europe/London", isPending: false, isError: false },
};
// What the one-tap plus loads by id, and what Undo removes.
export const mockGetFood = jest.fn<Promise<Food | null>, [unknown, string]>();
export const mockListFoodPortions = jest.fn<Promise<FoodPortion[]>, [unknown, string]>();
export const mockDeleteEntry = jest.fn<Promise<void>, [LogEntry]>();
// The foods logged most recently, which a test sets for a case.
export const recentFoods: { current: QueryState<RecentFood[]> } = {
  current: { data: [], isPending: false, isError: false },
};
// The options the two terms-gated reads were asked with, so a test can see whether they were enabled.
export const mockUseProfileTimeZone = jest.fn<
  QueryState<string | null>,
  [{ enabled?: boolean }?]
>();
export const mockUseRecentFoods = jest.fn<QueryState<RecentFood[]>, [{ enabled?: boolean }?]>();
// Whether the signed in account has accepted the current Terms, which a test turns off for the gate.
export const termsAccepted = { current: true };
export const mockUseFood = jest.fn<QueryState<Food | null>, [string | undefined]>();
export const mockUseFoodPortions = jest.fn<QueryState<FoodPortion[]>, [string | undefined]>();
export const mockUseFoodWithPortions = jest.fn<FoodWithPortionsState, [string]>();
// The refresh of a branded food stored before the portion rules. It asks the network, so the screens' tests
// only look at which food it was given.
export const mockUseRefreshOutdatedOffFood = jest.fn<undefined, [Food | null | undefined]>();
// The recipe the amount step reads by id, as the real hook states it. A test sets `recipeState` for a case.
export const recipeState: { current: RecipeState } = { current: { status: "loading" } };
export const mockUseRecipe = jest.fn<RecipeState, [string | undefined, { enabled?: boolean }?]>();

export const foodQuery: QueryState<Food | null> = {
  data: foodFixture,
  isPending: false,
  isError: false,
};
export const portionsQuery: QueryState<FoodPortion[]> = {
  data: portionFixtures,
  isPending: false,
  isError: false,
};

// What the real hook makes of the two queries, so a test sets the queries and the screen sees the state.
function foodWithPortionsState(): FoodWithPortionsState {
  if (foodQuery.data === undefined && foodQuery.isError) {
    return { status: "error", debugMessage: "The food query failed" };
  }
  if (portionsQuery.data === undefined && portionsQuery.isError) {
    return { status: "error", debugMessage: "The portions query failed" };
  }
  if (foodQuery.data === undefined || portionsQuery.data === undefined) {
    return { status: "loading" };
  }
  if (foodQuery.data === null) {
    return { status: "notFound" };
  }
  return { status: "ready", food: foodQuery.data, portions: portionsQuery.data };
}

export function resetApiClientMock(): void {
  mockCreateFood.mockReset();
  mockUpdateFood.mockReset();
  mockLogFood.mockReset();
  mockLogFood.mockResolvedValue({});
  mockLogRecipe.mockReset();
  profileTimeZone.current = { data: "Europe/London", isPending: false, isError: false };
  termsAccepted.current = true;
  mockUseProfileTimeZone.mockReset();
  mockUseProfileTimeZone.mockImplementation(() => profileTimeZone.current);
  mockUseRecentFoods.mockReset();
  mockUseRecentFoods.mockImplementation(() => recentFoods.current);
  recentFoods.current = { data: [], isPending: false, isError: false };
  mockGetFood.mockReset();
  mockGetFood.mockResolvedValue(foodFixture);
  mockListFoodPortions.mockReset();
  mockListFoodPortions.mockResolvedValue(portionFixtures);
  mockDeleteEntry.mockReset();
  mockDeleteEntry.mockResolvedValue(undefined);
  mockCreateFood.mockResolvedValue({ food: foodFixture, portions: [] });
  mockUpdateFood.mockResolvedValue(foodFixture);

  Object.assign(foodQuery, { data: foodFixture, isPending: false, isError: false });
  Object.assign(portionsQuery, { data: portionFixtures, isPending: false, isError: false });
  mockUseFood.mockReset();
  mockUseFood.mockImplementation(() => foodQuery);
  mockUseFoodPortions.mockReset();
  mockUseFoodPortions.mockImplementation(() => portionsQuery);
  mockUseFoodWithPortions.mockReset();
  mockUseFoodWithPortions.mockImplementation(foodWithPortionsState);
  mockUseRefreshOutdatedOffFood.mockReset();
  recipeState.current = { status: "loading" };
  mockUseRecipe.mockReset();
  mockUseRecipe.mockImplementation(() => recipeState.current);
}

// The real error classes stay in place so the screens' instanceof checks run against them.
// Only the hooks are replaced.
export const mockApiClient = {
  ...jest.requireActual<typeof ApiClient>("@keylow/api-client"),
  useCreateFood: () => ({ mutateAsync: mockCreateFood }),
  useUpdateFood: () => ({ mutateAsync: mockUpdateFood }),
  useLogFood: () => ({ mutateAsync: mockLogFood }),
  useLogRecipeServing: () => ({ mutateAsync: mockLogRecipe }),
  useProfileTimeZone: mockUseProfileTimeZone,
  useRecentFoods: mockUseRecentFoods,
  useDeleteEntry: () => ({ mutateAsync: mockDeleteEntry }),
  // The client is not used by these tests, but the stored diary cache listens to its auth events.
  useSupabase: () => ({
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
  }),
  getFood: mockGetFood,
  listFoodPortions: mockListFoodPortions,
  useFood: mockUseFood,
  useFoodPortions: mockUseFoodPortions,
  useFoodWithPortions: mockUseFoodWithPortions,
  useRefreshOutdatedOffFood: mockUseRefreshOutdatedOffFood,
  useRecipe: mockUseRecipe,
  // A signed in user here has accepted the current Terms, so the AuthGate's terms gate stays out of the way.
  useTermsAcceptance: () => ({
    isPending: false,
    isError: false,
    isFetching: false,
    data: termsAccepted.current
      ? { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: TERMS_VERSION }
      : null,
    refetch: jest.fn(),
  }),
};
