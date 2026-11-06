import {
  mockApiClient,
  mockGetFood,
  mockListFoodPortions,
} from "../../foods/support/apiClientMock";

import type * as ApiClient from "@keylow/api-client";
import type { LogEntriesItem } from "@keylow/api-client";

// The real code that reads the foods and builds the rows runs, over the foods tests' mocked reads.
const { plateEntriesOf } = jest.requireActual<typeof ApiClient>("@keylow/api-client");
const client = mockApiClient.useSupabase();

/** `useLogPlateEntries` for a test: the rows the plate would write go to `write`, the one mocked write. */
export const mockUseLogPlateEntries = (
  write: (rows: readonly LogEntriesItem[]) => Promise<unknown[]>,
) =>
  function useLogPlateEntries() {
    return {
      mutateAsync: async (input: ApiClient.LogPlateEntriesInput) =>
        write(
          await plateEntriesOf(
            {
              getFood: (foodId) => mockGetFood(client, foodId),
              listFoodPortions: (foodId) => mockListFoodPortions(client, foodId),
            },
            input,
          ),
        ),
    };
  };
