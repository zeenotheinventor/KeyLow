import { buildFood, buildFoodPortion } from "@keylow/core/testing";
import { HttpResponse } from "msw";

import type { Food, FoodPortion } from "@keylow/core/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

export const REST_URL = "http://127.0.0.1:54321/rest/v1";
export const AUTH_USER_URL = "http://127.0.0.1:54321/auth/v1/user";

export const SIGNED_IN_USER_ID = "11111111-1111-4111-8111-111111111111";

export const foodRow = (overrides: Partial<Food> = {}): Food =>
  buildFood({
    id: "22222222-2222-4222-8222-222222222222",
    owner_id: SIGNED_IN_USER_ID,
    name: "Protein flapjack",
    kcal: 410,
    protein_g: 22,
    fat_g: 14,
    carbs_g: 45,
    fibre_g: 6,
    created_at: "2026-10-07T10:00:00.123456+00:00",
    ...overrides,
  });

export const portionRow = (overrides: Partial<FoodPortion> = {}): FoodPortion =>
  buildFoodPortion({
    id: "33333333-3333-4333-8333-333333333333",
    food_id: "22222222-2222-4222-8222-222222222222",
    owner_id: SIGNED_IN_USER_ID,
    label: "1 bar",
    grams: 60,
    is_default: true,
    created_at: "2026-10-07T10:00:00.123456+00:00",
    ...overrides,
  });

/**
 * Answers the way PostgREST does: a single object when the caller asked for one
 * (`.single()` and `.maybeSingle()` on a write), otherwise an array of rows.
 */
export function postgrestRows(request: Request, rows: readonly unknown[], status = 200) {
  const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object+json") ?? false;

  if (!wantsObject) {
    return HttpResponse.json(rows, { status });
  }

  const [row] = rows;
  if (rows.length !== 1 || row === undefined) {
    return postgrestError(
      406,
      "PGRST116",
      "JSON object requested, multiple (or no) rows returned",
      {
        details: `The result contains ${rows.length} rows`,
      },
    );
  }

  return HttpResponse.json(row, { status });
}

export function postgrestError(
  status: number,
  code: string,
  message: string,
  extra: { details?: string } = {},
) {
  return HttpResponse.json(
    { code, message, details: extra.details ?? null, hint: null },
    { status },
  );
}

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/**
 * Gives a test client a session without a real sign-in. The token is unsigned and only has to
 * decode, so the GoTrue user endpoint (mocked by the caller) is what vouches for the user.
 */
export async function signInAs(client: SupabaseClient, userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = [
    encodeSegment({ alg: "HS256", typ: "JWT" }),
    encodeSegment({ sub: userId, role: "authenticated", aud: "authenticated", exp: expiresAt }),
    encodeSegment({ note: "unsigned" }),
  ].join(".");

  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: "test-refresh-token",
  });

  if (error) {
    throw new Error("Could not start the test session", { cause: error });
  }
}
