import { HttpResponse } from "msw";

import { foodRow } from "./postgrest";

import type { FoodSearchHit } from "../../src/repos/foods";
import type { EdgeErrorCode, OffCandidate } from "@keylow/core/schemas";

export const SEARCH_FOODS_URL = "http://127.0.0.1:54321/rest/v1/rpc/search_foods";
export const OFF_SEARCH_URL = "http://127.0.0.1:54321/functions/v1/off-search";

/** A row of the `search_foods` RPC: a food row plus the relevance score. */
export const searchHitRow = (overrides: Partial<FoodSearchHit> = {}): FoodSearchHit => ({
  ...foodRow(),
  score: 1,
  ...overrides,
});

/** `count` hits with distinct ids and names, best score first. */
export const searchHitRows = (count: number): FoodSearchHit[] =>
  Array.from({ length: count }, (_, index) =>
    searchHitRow({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      name: `Chicken ${index + 1}`,
      score: count - index,
    }),
  );

export const offCandidate = (overrides: Partial<OffCandidate> = {}): OffCandidate => ({
  code: "5000000000017",
  name: "Chicken soup",
  brand: "Test Brand",
  basis: "per_100g",
  kcal: 45,
  protein_g: 2.5,
  fat_g: 1.5,
  carbs_g: 5,
  fibre_g: 0.5,
  quality: {},
  ...overrides,
});

/** The error body every Edge Function answers with. */
export const edgeErrorResponse = (
  status: number,
  code: EdgeErrorCode,
  message: string,
  retryAfterSeconds?: number,
) =>
  HttpResponse.json(
    {
      error: {
        code,
        message,
        ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
      },
    },
    { status },
  );
