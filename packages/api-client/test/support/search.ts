import { buildOffCandidate } from "@keylow/core/testing";
import { HttpResponse } from "msw";

import type { FoodSearchHit } from "../../src/repos/foods";
import type { EdgeErrorCode, OffCandidate } from "@keylow/core/schemas";

export const SEARCH_FOODS_URL = "http://127.0.0.1:54321/rest/v1/rpc/search_foods";
export const OFF_SEARCH_URL = "http://127.0.0.1:54321/functions/v1/off-search";

/** A row of the `search_foods` RPC: the lean list fields, no default portion unless given, and a score. */
export const searchHitRow = (overrides: Partial<FoodSearchHit> = {}): FoodSearchHit => ({
  id: "22222222-2222-4222-8222-222222222222",
  source: "user",
  name: "Protein flapjack",
  brand: null,
  basis: "per_100g",
  kcal: 410,
  protein_g: 22,
  fat_g: 14,
  carbs_g: 45,
  fibre_g: 6,
  quality: {},
  default_portion_id: null,
  default_portion_label: null,
  default_portion_grams: null,
  default_portion_ml: null,
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

export const offCandidate = (overrides: Partial<OffCandidate> = {}): OffCandidate =>
  buildOffCandidate({
    code: "5000000000017",
    name: "Chicken soup",
    brand: "Test Brand",
    kcal: 45,
    protein_g: 2.5,
    fat_g: 1.5,
    carbs_g: 5,
    fibre_g: 0.5,
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
