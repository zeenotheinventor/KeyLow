import { buildFoodSnapshot } from "@keylow/core/diary";
import { buildFood } from "@keylow/core/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDiaryDay } from "../../src/hooks/useDiaryDay";
import { useUpdateEntry } from "../../src/hooks/useUpdateEntry";
import { keys } from "../../src/queryKeys";
import { FOOD_ID, foodEntryRow } from "../support/diary";
import { installDiaryFake } from "../support/diaryFake";
import { REST_URL, foodRow, postgrestRows } from "../support/postgrest";
import { goldenYieldRecipe, recipeEntryRow } from "../support/recipeEntries";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const DAY = "2026-10-15";
const NEXT_DAY = "2026-10-16";
const lateSnack = foodEntryRow({
  local_date: DAY,
  logged_at: `${DAY}T23:30:00+00:00`,
  snapshot: buildFoodSnapshot(buildFood({ id: FOOD_ID, name: "Rolled oats", kcal: 200 }), {
    quantity: 50,
    unit: "g",
  }),
});

const renderDays = async (fake: ReturnType<typeof installDiaryFake>) => {
  const rendered = createWrapper();
  const hook = renderHook(
    () => ({ day: useDiaryDay(DAY), nextDay: useDiaryDay(NEXT_DAY), update: useUpdateEntry() }),
    { wrapper: rendered.wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.day.isSuccess && hook.result.current.nextDay.isSuccess).toBe(true);
  });
  return { ...rendered, ...hook, fake };
};

describe("useUpdateEntry", () => {
  it("should change the amount of a recipe entry from its own snapshot and show it in the day", async () => {
    const dinner = recipeEntryRow({
      recipe: goldenYieldRecipe,
      quantity: 1,
      unit: "serving",
      loggedAt: `${DAY}T17:00:00.000Z`,
      localDate: DAY,
    });
    const fake = installDiaryFake(server, [dinner]);
    const { queryClient, result } = await renderDays(fake);
    fake.holdReads();

    const updated = await act(() =>
      result.current.update.mutateAsync({
        entry: dinner,
        amount: { quantity: 1.5, unit: "serving" },
      }),
    );

    expect(updated).toMatchObject({
      item_type: "recipe",
      quantity: 1.5,
      resolved_grams: 412.5,
      recipe_id: dinner.recipe_id,
    });
    expect(updated.nutrients.kcal).toBeCloseTo(561.3, 1);
    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ id: dinner.id, item_type: "recipe", quantity: 1.5 }],
    });
  });

  it("should change the amount from the entry's own snapshot and show it in the day", async () => {
    const fake = installDiaryFake(server, [lateSnack]);
    const { queryClient, result } = await renderDays(fake);
    fake.holdReads();

    const updated = await act(() =>
      result.current.update.mutateAsync({ entry: lateSnack, amount: { quantity: 100, unit: "g" } }),
    );

    expect(updated).toMatchObject({ quantity: 100, resolved_grams: 100, nutrients: { kcal: 200 } });
    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ id: lateSnack.id, quantity: 100 }],
    });
  });

  it("should move an entry from 23:30 to 00:15 into the next day", async () => {
    const fake = installDiaryFake(server, [lateSnack]);
    const { queryClient, result } = await renderDays(fake);
    fake.holdReads();

    await act(() =>
      result.current.update.mutateAsync({
        entry: lateSnack,
        time: { loggedAt: `${NEXT_DAY}T00:15:00.000Z`, timeZone: "UTC" },
      }),
    );

    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({ entries: [] });
    expect(queryClient.getQueryData(keys.diary.day(NEXT_DAY))).toMatchObject({
      entries: [{ id: lateSnack.id, local_date: NEXT_DAY }],
    });
  });

  it("should refresh the days after the write", async () => {
    const fake = installDiaryFake(server, [lateSnack]);
    const { result } = await renderDays(fake);
    const before = fake.requests.dayReads;

    await act(() =>
      result.current.update.mutateAsync({ entry: lateSnack, amount: { quantity: 100, unit: "g" } }),
    );

    await waitFor(() => {
      expect(fake.requests.dayReads).toBe(before + 2);
    });
  });

  it("should rebuild the entry from the food as it is now for the current food data", async () => {
    const fake = installDiaryFake(server, [lateSnack]);
    server.use(
      http.get(`${REST_URL}/foods`, ({ request }) =>
        postgrestRows(request, [foodRow({ id: FOOD_ID, name: "Rolled oats", kcal: 400 })]),
      ),
      http.get(`${REST_URL}/food_portions`, ({ request }) => postgrestRows(request, [])),
    );
    const { result } = await renderDays(fake);

    const updated = await act(() =>
      result.current.update.mutateAsync({ entry: lateSnack, useCurrentFoodData: true }),
    );

    expect(updated).toMatchObject({
      quantity: 50,
      snapshot: { per100: { kcal: 400 } },
      nutrients: { kcal: 200 },
    });
  });

  it("should expose the error and leave the cache alone when the update fails", async () => {
    const fake = installDiaryFake(server, [lateSnack]);
    const { queryClient, result } = await renderDays(fake);
    fake.failWrites();

    await act(async () => {
      await result.current.update
        .mutateAsync({ entry: lateSnack, amount: { quantity: 100, unit: "g" } })
        .catch(() => undefined);
    });

    expect(result.current.update.isError).toBe(true);
    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ id: lateSnack.id, quantity: 50 }],
    });
  });
});
