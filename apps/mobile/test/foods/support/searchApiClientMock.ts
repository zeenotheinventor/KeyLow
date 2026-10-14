import { mockApiClient } from "./apiClientMock";

import type { FoodSearchResult } from "@keylow/api-client";
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

export const offCandidateFixture: OffCandidate = {
  code: "5000168001234",
  name: "Oat drink",
  brand: "Oatly",
  basis: "per_100ml",
  kcal: 46,
  protein_g: 1,
  fat_g: 1.5,
  carbs_g: 6.7,
  fibre_g: 0.8,
  quality: {},
};

type OwnFoodsState =
  | { isPending: true; isError: false; data: undefined }
  | { isPending: false; isError: true; data: Food[] | undefined }
  | { isPending: false; isError: false; data: Food[] };

export const mockMaterialiseOffProduct = jest.fn<Promise<Food>, [{ code: string }]>();
export const mockUseFoodSearch = jest.fn<FoodSearchResult, [string]>();
export const mockUseOwnFoods = jest.fn<OwnFoodsState, []>();

// The test sets the whole search result for a case, and a reset puts back the idle one.
export const searchResult: FoodSearchResult = { ...idleSearch };

// The user's own foods, which a test sets the same way.
export const ownFoodsResult: { current: OwnFoodsState } = {
  current: { isPending: false, isError: false, data: [] },
};

export function resetSearchApiClientMock(): void {
  Object.assign(searchResult, idleSearch);
  ownFoodsResult.current = { isPending: false, isError: false, data: [] };
  mockUseFoodSearch.mockReset();
  mockUseFoodSearch.mockImplementation(() => searchResult);
  mockUseOwnFoods.mockReset();
  mockUseOwnFoods.mockImplementation(() => ownFoodsResult.current);
  mockMaterialiseOffProduct.mockReset();
}

// Builds on the food form mock, so one factory serves the screens that load a food too.
export const mockSearchApiClient = {
  ...mockApiClient,
  useFoodSearch: mockUseFoodSearch,
  useOwnFoods: mockUseOwnFoods,
  useMaterialiseOffProduct: () => ({ mutateAsync: mockMaterialiseOffProduct }),
};
