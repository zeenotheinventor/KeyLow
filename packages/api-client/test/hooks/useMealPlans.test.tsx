import { buildFood } from "@keylow/core/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useArchiveMealPlan } from "../../src/hooks/useArchiveMealPlan";
import { useConfirmMealPlanDay } from "../../src/hooks/useConfirmMealPlanDay";
import { useMealPlanRepeatLimit } from "../../src/hooks/useMealPlanRepeatLimit";
import { useMealPlans } from "../../src/hooks/useMealPlans";
import { useReplaceMealPlanDay } from "../../src/hooks/useReplaceMealPlanDay";
import { useSaveMealPlan } from "../../src/hooks/useSaveMealPlan";
import { useSetMealPlanRepeatLimit } from "../../src/hooks/useSetMealPlanRepeatLimit";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import {
  AUTH_USER_URL,
  REST_URL,
  SIGNED_IN_USER_ID,
  postgrestRows,
  signInAs,
} from "../support/postgrest";
import { databaseErrorQuotingTheRow, expectNoQuotedText } from "../support/quotedDatabaseError";
import { createWrapper } from "../support/wrapper";

const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DAY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FOOD_ID = "55555555-5555-4555-8555-555555555555";
const ENTRY_ID = "77777777-7777-4777-8777-777777777777";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const planRow = {
  id: PLAN_ID,
  start_date: "2026-12-14",
  day_count: 1,
  rules: {},
  source: "app",
  archived_at: null,
  created_at: "2026-11-13T10:00:00+00:00",
  meal_plan_days: [],
};

const foodItem = {
  position: 0,
  slotTime: "08:00",
  kind: "food",
  foodId: FOOD_ID,
  grams: 50,
  portionId: null,
  nutrients: {},
  snapshot: {},
} as const;

describe("useMealPlans", () => {
  it("should load the person's live plans", async () => {
    server.use(
      http.get(`${REST_URL}/meal_plans`, ({ request }) => postgrestRows(request, [planRow])),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMealPlans(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.[0]?.id).toBe(PLAN_ID);
  });

  it("should make no request while disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMealPlans({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("should surface an error that names the action and the code only", async () => {
    server.use(http.get(`${REST_URL}/meal_plans`, () => databaseErrorQuotingTheRow("42501")));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMealPlans(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your meal plans (42501)");
    expectNoQuotedText(result.current.error ?? new Error("no error"));
  });
});

describe("the plan writes", () => {
  it("should refresh the plans after a save", async () => {
    let plansRead = 0;
    server.use(
      http.get(`${REST_URL}/meal_plans`, ({ request }) => {
        plansRead += 1;
        return postgrestRows(request, [planRow]);
      }),
      http.post(`${REST_URL}/rpc/save_meal_plan`, () => HttpResponse.json(PLAN_ID)),
    );
    const { wrapper } = createWrapper();
    const plans = renderHook(() => useMealPlans(), { wrapper });
    await waitFor(() => {
      expect(plans.result.current.isSuccess).toBe(true);
    });
    const { result } = renderHook(() => useSaveMealPlan(), { wrapper });

    let id: string | undefined;
    await act(async () => {
      id = await result.current.mutateAsync({
        startDate: "2026-12-14",
        source: "app",
        rules: {},
        days: [{ localDate: "2026-12-14", target: {} }],
        items: [{ localDate: "2026-12-14", ...foodItem }],
      });
    });

    expect(id).toBe(PLAN_ID);
    await waitFor(() => {
      expect(plansRead).toBe(2);
    });
  });

  it("should refresh the plans after a day is replaced", async () => {
    let plansRead = 0;
    server.use(
      http.get(`${REST_URL}/meal_plans`, ({ request }) => {
        plansRead += 1;
        return postgrestRows(request, [planRow]);
      }),
      http.post(
        `${REST_URL}/rpc/replace_meal_plan_day`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const { wrapper } = createWrapper();
    renderHook(() => useMealPlans(), { wrapper });
    await waitFor(() => {
      expect(plansRead).toBe(1);
    });
    const { result } = renderHook(() => useReplaceMealPlanDay(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ dayId: DAY_ID, items: [foodItem] });
    });

    await waitFor(() => {
      expect(plansRead).toBe(2);
    });
  });

  it("should refresh the plans and the diary after a day is confirmed", async () => {
    let plansRead = 0;
    server.use(
      http.get(`${REST_URL}/meal_plans`, ({ request }) => {
        plansRead += 1;
        return postgrestRows(request, [planRow]);
      }),
      http.post(`${REST_URL}/rpc/confirm_meal_plan_day`, () => HttpResponse.json([ENTRY_ID])),
    );
    const { wrapper, queryClient } = createWrapper();
    renderHook(() => useMealPlans(), { wrapper });
    await waitFor(() => {
      expect(plansRead).toBe(1);
    });
    const diaryDay = [...keys.diary.days, "2026-12-14"];
    queryClient.setQueryData(diaryDay, ["stale"]);
    const { result } = renderHook(() => useConfirmMealPlanDay(), { wrapper });

    let ids: string[] | undefined;
    await act(async () => {
      ids = await result.current.mutateAsync({
        dayId: DAY_ID,
        items: [
          {
            kind: "food",
            input: {
              food: buildFood({ id: FOOD_ID }),
              quantity: 50,
              unit: "g",
              loggedAt: "2026-12-14T08:00:00.000Z",
              localDate: "2026-12-14",
            },
          },
        ],
      });
    });

    expect(ids).toStrictEqual([ENTRY_ID]);
    await waitFor(() => {
      expect(plansRead).toBe(2);
    });
    expect(queryClient.getQueryState(diaryDay)?.isInvalidated).toBe(true);
  });

  it("should refresh the plans after a plan is archived, and also after a failure", async () => {
    let plansRead = 0;
    server.use(
      http.get(`${REST_URL}/meal_plans`, ({ request }) => {
        plansRead += 1;
        return postgrestRows(request, [planRow]);
      }),
      http.patch(`${REST_URL}/meal_plans`, () => databaseErrorQuotingTheRow("42501")),
    );
    const { wrapper } = createWrapper();
    renderHook(() => useMealPlans(), { wrapper });
    await waitFor(() => {
      expect(plansRead).toBe(1);
    });
    const { result } = renderHook(() => useArchiveMealPlan(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(PLAN_ID).catch(() => undefined);
    });

    await waitFor(() => {
      expect(plansRead).toBe(2);
    });
    expect(result.current.error?.message).toBe("Could not remove your meal plan (42501)");
  });
});

describe("the repeat limit", () => {
  it("should load the limit the person chose", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) =>
        postgrestRows(request, [{ meal_plan_repeat_limit: 3 }]),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMealPlanRepeatLimit(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe(3);
  });

  it("should make no request while disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useMealPlanRepeatLimit({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });

  it("should write the choice to the signed in user's profile and read the limit again", async () => {
    let stored: number | null = null;
    const patches: unknown[] = [];
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) =>
        postgrestRows(request, [{ meal_plan_repeat_limit: stored }]),
      ),
      http.patch<never, { meal_plan_repeat_limit: number | null }>(
        `${REST_URL}/profiles`,
        async ({ request }) => {
          const body = await request.clone().json();
          patches.push({ url: new URL(request.url).search, body });
          stored = body.meal_plan_repeat_limit;
          return postgrestRows(request, [{ id: SIGNED_IN_USER_ID }]);
        },
      ),
    );
    const client = createTestClient();
    await signInAs(client, SIGNED_IN_USER_ID);
    const { wrapper } = createWrapper(client);
    const limit = renderHook(() => useMealPlanRepeatLimit(), { wrapper });
    await waitFor(() => {
      expect(limit.result.current.data).toBeNull();
    });
    const { result } = renderHook(() => useSetMealPlanRepeatLimit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(0);
    });

    expect(patches).toStrictEqual([
      { url: `?id=eq.${SIGNED_IN_USER_ID}&select=id`, body: { meal_plan_repeat_limit: 0 } },
    ]);
    await waitFor(() => {
      expect(limit.result.current.data).toBe(0);
    });
  });

  it("should send nothing for a limit outside 0 to 7", async () => {
    const client = createTestClient();
    await signInAs(client, SIGNED_IN_USER_ID);
    const { wrapper } = createWrapper(client);
    const { result } = renderHook(() => useSetMealPlanRepeatLimit(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(8).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.error?.message).toBe("Could not save your repeat limit (invalid)");
    });
  });
});
