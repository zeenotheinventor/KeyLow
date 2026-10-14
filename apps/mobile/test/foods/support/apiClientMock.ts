import type * as ApiClient from "@keylow/api-client";
import type { CreatedFood, FoodWithPortionsState } from "@keylow/api-client";
import type { Food, FoodPortion } from "@keylow/core/schemas";

type QueryState<Data> = { data: Data | undefined; isPending: boolean; isError: boolean };

export const savedFoodId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";

export const foodFixture: Food = {
  id: savedFoodId,
  source: "user",
  source_ref: null,
  owner_id: ownerId,
  name: "Oat bar",
  brand: "Acme",
  barcode: "5012345678900",
  basis: "per_100g",
  density_g_per_ml: null,
  kcal: 420,
  protein_g: 8.5,
  fat_g: 14,
  sat_fat_g: null,
  carbs_g: 62,
  sugars_g: null,
  fibre_g: 6.5,
  salt_g: null,
  micros: {},
  quality: {},
  food_group: null,
  fetched_at: null,
  deleted_at: null,
  created_at: "2026-10-07T09:00:00Z",
};

export const portionFixtures: FoodPortion[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    food_id: savedFoodId,
    owner_id: ownerId,
    label: "1 bar",
    grams: 45,
    ml: null,
    is_default: true,
    position: 0,
    created_at: "2026-10-07T09:00:00Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    food_id: savedFoodId,
    owner_id: ownerId,
    label: "Box of 6",
    grams: 270,
    ml: null,
    is_default: false,
    position: 1,
    created_at: "2026-10-07T09:00:00Z",
  },
];

export const mockCreateFood = jest.fn<Promise<CreatedFood>, [unknown]>();
export const mockUpdateFood = jest.fn<Promise<Food>, [{ id: string; input: unknown }]>();
export const mockUseFood = jest.fn<QueryState<Food | null>, [string | undefined]>();
export const mockUseFoodPortions = jest.fn<QueryState<FoodPortion[]>, [string | undefined]>();
export const mockUseFoodWithPortions = jest.fn<FoodWithPortionsState, [string]>();

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
}

// The real error classes stay in place so the screens' instanceof checks run against them.
// Only the hooks are replaced.
export const mockApiClient = {
  ...jest.requireActual<typeof ApiClient>("@keylow/api-client"),
  useCreateFood: () => ({ mutateAsync: mockCreateFood }),
  useUpdateFood: () => ({ mutateAsync: mockUpdateFood }),
  useFood: mockUseFood,
  useFoodPortions: mockUseFoodPortions,
  useFoodWithPortions: mockUseFoodWithPortions,
};
