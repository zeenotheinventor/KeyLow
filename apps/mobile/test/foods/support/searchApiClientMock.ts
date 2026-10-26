import { buildOffCandidate } from "@keylow/core/testing";

import { mockApiClient } from "./apiClientMock";

import type {
  FoodSearchResult,
  LogEntriesItem,
  RecipeSearchResult,
  UseRecipeSearchOptions,
} from "@keylow/api-client";
import type { Food, OffCandidate } from "@keylow/core/schemas";

export const idleSearch: FoodSearchResult = {
  local: [],
  off: [],
  isLoadingLocal: false,
  isLoadingOff: false,
  isDebouncing: false,
  offError: null,
  localError: null,
};

export const idleRecipeSearch: RecipeSearchResult = {
  recipes: [],
  isLoading: false,
  isDebouncing: false,
  error: null,
};

export const offCandidateFixture: OffCandidate = buildOffCandidate({
  code: "5000168001234",
  name: "Oat drink",
  brand: "Oatly",
  basis: "per_100ml",
  kcal: 46,
  protein_g: 1,
  fat_g: 1.5,
  carbs_g: 6.7,
  fibre_g: 0.8,
});

/** What the paged hook says about the pages after the first. A test leaves it out for a list that has them all. */
export type OwnFoodsPaging = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => void;
};

type OwnFoodsState =
  | { isPending: true; isError: false; data: undefined }
  | ({ isPending: false; isError: true; data: Food[] | undefined } & Partial<OwnFoodsPaging>)
  | ({ isPending: false; isError: false; data: Food[] } & Partial<OwnFoodsPaging>);

export const mockMaterialiseOffProduct = jest.fn<Promise<Food>, [{ code: string }]>();
export const mockUseFoodSearch = jest.fn<FoodSearchResult, [string]>();
export const mockUseOwnFoods = jest.fn<OwnFoodsState, []>();
export const mockLogEntries = jest.fn<Promise<unknown[]>, [readonly LogEntriesItem[]]>();
export const mockQuickAdd = jest.fn<Promise<unknown>, [unknown]>();

type DayRead = {
  data: { entries: { nutrients: Record<string, number | null> }[] } | undefined;
  isError: boolean;
};
type TargetsRead = {
  data:
    | {
        kcal: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
      }
    | undefined;
  isError: boolean;
};

// What the day was eaten as, which the search's bars start from: the M3 sample day (1,039 kcal).
export const eatenDay: { current: DayRead } = {
  current: {
    data: {
      entries: [{ nutrients: { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 } }],
    },
    isError: false,
  },
};
// The targets the bars are measured against (the M3 sample targets).
export const dayTargets: { current: TargetsRead } = {
  current: { data: { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 }, isError: false },
};
export const mockUseDiaryDay = jest.fn<DayRead, [string, { enabled?: boolean }?]>();
export const mockUseTargets = jest.fn<TargetsRead, [{ enabled?: boolean; localDate?: string }?]>();
export const mockUseRecipeSearch = jest.fn<RecipeSearchResult, [string, UseRecipeSearchOptions?]>();

// The test sets the whole search result for a case, and a reset puts back the idle one.
export const searchResult: FoodSearchResult = { ...idleSearch };

// The user's recipes that match, which a test sets the same way.
export const recipeSearchResult: RecipeSearchResult = { ...idleRecipeSearch };

// The user's own foods, which a test sets the same way.
export const ownFoodsResult: { current: OwnFoodsState } = {
  current: { isPending: false, isError: false, data: [] },
};

export function resetSearchApiClientMock(): void {
  Object.assign(searchResult, idleSearch);
  Object.assign(recipeSearchResult, idleRecipeSearch);
  ownFoodsResult.current = { isPending: false, isError: false, data: [] };
  mockUseFoodSearch.mockReset();
  mockUseFoodSearch.mockImplementation(() => searchResult);
  mockUseRecipeSearch.mockReset();
  mockUseRecipeSearch.mockImplementation(() => recipeSearchResult);
  mockUseOwnFoods.mockReset();
  mockUseOwnFoods.mockImplementation(() => ownFoodsResult.current);
  mockMaterialiseOffProduct.mockReset();
  mockLogEntries.mockReset();
  mockLogEntries.mockResolvedValue([]);
  mockQuickAdd.mockReset();
  mockQuickAdd.mockResolvedValue({});
  eatenDay.current = {
    data: {
      entries: [{ nutrients: { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 } }],
    },
    isError: false,
  };
  dayTargets.current = {
    data: { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 },
    isError: false,
  };
  mockUseDiaryDay.mockReset();
  mockUseDiaryDay.mockImplementation(() => eatenDay.current);
  mockUseTargets.mockReset();
  mockUseTargets.mockImplementation(() => dayTargets.current);
}

// Builds on the food form mock, so one factory serves the screens that load a food too.
export const mockSearchApiClient = {
  ...mockApiClient,
  useFoodSearch: mockUseFoodSearch,
  useOwnFoods: mockUseOwnFoods,
  useRecipeSearch: mockUseRecipeSearch,
  useLogEntries: () => ({ mutateAsync: mockLogEntries }),
  useQuickAdd: () => ({ mutateAsync: mockQuickAdd }),
  useDiaryDay: mockUseDiaryDay,
  useTargets: mockUseTargets,
  useMaterialiseOffProduct: () => ({ mutateAsync: mockMaterialiseOffProduct }),
};
