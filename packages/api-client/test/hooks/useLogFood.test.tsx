import { buildFood } from "@keylow/core/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDeleteEntry } from "../../src/hooks/useDeleteEntry";
import { useDiaryDay } from "../../src/hooks/useDiaryDay";
import { useDiaryWeek } from "../../src/hooks/useDiaryWeek";
import { useLogFood } from "../../src/hooks/useLogFood";
import { useRecentFoods } from "../../src/hooks/useRecentFoods";
import { keys } from "../../src/queryKeys";
import { FOOD_ID, foodEntryRow } from "../support/diary";
import { installDiaryFake } from "../support/diaryFake";
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

const oats = buildFood({ id: FOOD_ID, name: "Rolled oats", kcal: 200 });
const DAY = "2026-10-15";

const noon = {
  food: oats,
  quantity: 50,
  unit: "g",
  loggedAt: `${DAY}T12:00:00.000Z`,
  localDate: DAY,
} as const;
const evening = { ...noon, quantity: 80, loggedAt: `${DAY}T18:30:00.000Z` } as const;

describe("useLogFood", () => {
  it("should insert the entry and resolve to the stored row", async () => {
    const fake = installDiaryFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogFood(), { wrapper });

    const entry = await act(() => result.current.mutateAsync(noon));

    expect(entry).toMatchObject({
      item_type: "food",
      food_id: FOOD_ID,
      local_date: DAY,
      quantity: 50,
    });
    expect(fake.rows.map((row) => row.id)).toEqual([entry.id]);
  });

  it("should show the new entry in its day at once, before the day is read again", async () => {
    const fake = installDiaryFake(server, [
      foodEntryRow({ local_date: DAY, logged_at: `${DAY}T08:00:00+00:00` }),
    ]);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => ({ day: useDiaryDay(DAY), log: useLogFood() }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.day.isSuccess).toBe(true);
    });
    const releaseReads = fake.holdReads();

    const entry = await act(() => result.current.log.mutateAsync(noon));

    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ logged_at: `${DAY}T08:00:00+00:00` }, { id: entry.id }],
    });
    releaseReads();
  });

  it("should keep the entries of the day in time order when one is logged earlier than the rest", async () => {
    const fake = installDiaryFake(server, [
      foodEntryRow({ local_date: DAY, logged_at: `${DAY}T08:00:00+00:00` }),
    ]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => ({ day: useDiaryDay(DAY), log: useLogFood() }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.day.isSuccess).toBe(true);
    });
    fake.holdReads();

    await act(() => result.current.log.mutateAsync({ ...noon, loggedAt: `${DAY}T06:15:00.000Z` }));

    expect(result.current.day.data?.entries.map((entry) => entry.logged_at.slice(11, 16))).toEqual([
      "06:15",
      "08:00",
    ]);
  });

  it("should refresh the day, the week and the recent foods", async () => {
    const fake = installDiaryFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        day: useDiaryDay(DAY),
        week: useDiaryWeek("2026-10-12"),
        recent: useRecentFoods(),
        log: useLogFood(),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(
        result.current.day.isSuccess &&
          result.current.week.isSuccess &&
          result.current.recent.isSuccess,
      ).toBe(true);
    });
    const before = { ...fake.requests };

    await act(() => result.current.log.mutateAsync(noon));

    await waitFor(() => {
      expect(fake.requests.dayReads).toBe(before.dayReads + 1);
      // The day and the week both read the day logs.
      expect(fake.requests.dayLogReads).toBe(before.dayLogReads + 2);
      expect(fake.requests.recentReads).toBe(before.recentReads + 1);
    });
    expect(result.current.recent.data?.map((food) => food.foodId)).toEqual([FOOD_ID]);
  });

  it("should mark the cached days stale, so a day not on screen is read again when it is opened", async () => {
    installDiaryFake(server);
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.diary.day("2026-10-14"), {
      localDate: "2026-10-14",
      entries: [],
      dayLog: null,
      totals: null,
    });
    const { result } = renderHook(() => useLogFood(), { wrapper });

    await act(() => result.current.mutateAsync(noon));

    expect(queryClient.getQueryState(keys.diary.day("2026-10-14"))?.isInvalidated).toBe(true);
  });

  it("should leave the complete days alone", async () => {
    installDiaryFake(server);
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.diary.completeDays("2026-10"), ["2026-10-03"]);
    const { result } = renderHook(() => useLogFood(), { wrapper });

    await act(() => result.current.mutateAsync(noon));

    expect(queryClient.getQueryState(keys.diary.completeDays("2026-10"))?.isInvalidated).toBe(
      false,
    );
  });

  describe("one tap on the plus of several rows in a row", () => {
    it("should resolve each call to the entry it inserted", async () => {
      const fake = installDiaryFake(server);
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useLogFood(), { wrapper });

      const [first, second] = await act(() =>
        Promise.all([result.current.mutateAsync(noon), result.current.mutateAsync(evening)]),
      );

      expect(first.id).not.toBe(second.id);
      expect([first.quantity, second.quantity]).toEqual([50, 80]);
      expect(fake.rows).toHaveLength(2);
    });

    it("should let the Undo of one call remove only that entry", async () => {
      const fake = installDiaryFake(server);
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => ({ log: useLogFood(), remove: useDeleteEntry() }), {
        wrapper,
      });

      const [first, second] = await act(() =>
        Promise.all([
          result.current.log.mutateAsync(noon),
          result.current.log.mutateAsync(evening),
        ]),
      );
      await act(() => result.current.remove.mutateAsync(first));

      expect(fake.rows.filter((row) => row.deleted_at === null).map((row) => row.id)).toEqual([
        second.id,
      ]);
    });

    it("should show every entry in the day without waiting for a read", async () => {
      const fake = installDiaryFake(server);
      const { queryClient, wrapper } = createWrapper();
      const { result } = renderHook(() => ({ day: useDiaryDay(DAY), log: useLogFood() }), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.day.isSuccess).toBe(true);
      });
      fake.holdReads();

      await act(() =>
        Promise.all([
          result.current.log.mutateAsync(noon),
          result.current.log.mutateAsync(evening),
        ]),
      );

      const cached = queryClient.getQueryData(keys.diary.day(DAY));
      expect(cached).toMatchObject({ entries: [{ quantity: 50 }, { quantity: 80 }] });
    });
  });

  it("should expose the error and leave the cache alone when the insert fails", async () => {
    const fake = installDiaryFake(server);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => ({ day: useDiaryDay(DAY), log: useLogFood() }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.day.isSuccess).toBe(true);
    });
    fake.failWrites();

    await act(async () => {
      await result.current.log.mutateAsync(noon).catch(() => undefined);
    });

    expect(result.current.log.error).toHaveProperty("cause.message", "unavailable");
    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({ entries: [] });
  });

  it("should send no meal slot, and return none", async () => {
    const fake = installDiaryFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogFood(), { wrapper });

    const entry = await act(() => result.current.mutateAsync(noon));

    expect(JSON.stringify(fake.rows)).not.toMatch(/slot/i);
    expect(JSON.stringify(entry)).not.toMatch(/slot/i);
  });
});
