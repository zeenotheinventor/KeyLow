import { buildFood } from "@keylow/core/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDiaryDay } from "../../src/hooks/useDiaryDay";
import { useDiaryWeek } from "../../src/hooks/useDiaryWeek";
import { useLogEntries } from "../../src/hooks/useLogEntries";
import { useRecentFoods } from "../../src/hooks/useRecentFoods";
import { keys } from "../../src/queryKeys";
import { FOOD_ID, foodEntryRow } from "../support/diary";
import { installDiaryFake } from "../support/diaryFake";
import { loggableRecipe } from "../support/recipeEntries";
import { createWrapper } from "../support/wrapper";

import type { LogEntriesItem } from "../../src/repos/diaryWrites";

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
const NEXT_DAY = "2026-10-16";

const timing = { loggedAt: `${DAY}T12:00:00.000Z`, localDate: DAY } as const;
const oatsInGrams = (quantity: number): LogEntriesItem => ({
  kind: "food",
  input: { food: oats, quantity, unit: "g", ...timing },
});
const stewServing: LogEntriesItem = {
  kind: "recipe",
  input: { recipe: loggableRecipe, quantity: 1, unit: "serving", ...timing },
};
const plate = [oatsInGrams(50), stewServing, oatsInGrams(80), oatsInGrams(120)];

describe("useLogEntries", () => {
  it("should send one request for the whole plate and resolve to the stored rows in order", async () => {
    const fake = installDiaryFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogEntries(), { wrapper });

    const entries = await act(() => result.current.mutateAsync(plate));

    expect(fake.requests.writes).toBe(1);
    expect(entries.map(({ item_type }) => item_type)).toEqual(["food", "recipe", "food", "food"]);
    expect(fake.rows.map(({ id }) => id)).toEqual(entries.map(({ id }) => id));
    expect(entries.map(({ quantity }) => quantity)).toEqual([50, 1, 80, 120]);
  });

  it("should show every row in its day at once, in the order of the plate, before the day is read again", async () => {
    const fake = installDiaryFake(server, [
      foodEntryRow({ local_date: DAY, logged_at: `${DAY}T08:00:00+00:00` }),
    ]);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => ({ day: useDiaryDay(DAY), log: useLogEntries() }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.day.isSuccess).toBe(true);
    });
    const releaseReads = fake.holdReads();

    const entries = await act(() => result.current.log.mutateAsync(plate));

    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ logged_at: `${DAY}T08:00:00+00:00` }, ...entries.map(({ id }) => ({ id }))],
    });
    releaseReads();
  });

  it("should put each row in the cache of its own day", async () => {
    const fake = installDiaryFake(server);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ day: useDiaryDay(DAY), nextDay: useDiaryDay(NEXT_DAY), log: useLogEntries() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.day.isSuccess && result.current.nextDay.isSuccess).toBe(true);
    });
    fake.holdReads();
    const tomorrow: LogEntriesItem = {
      kind: "food",
      input: {
        food: oats,
        quantity: 30,
        unit: "g",
        loggedAt: `${NEXT_DAY}T07:00:00.000Z`,
        localDate: NEXT_DAY,
      },
    };

    await act(() => result.current.log.mutateAsync([oatsInGrams(50), tomorrow]));

    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ quantity: 50 }],
    });
    expect(queryClient.getQueryData(keys.diary.day(NEXT_DAY))).toMatchObject({
      entries: [{ quantity: 30 }],
    });
  });

  it("should refresh the day, the week and the recent foods after the write", async () => {
    const fake = installDiaryFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        day: useDiaryDay(DAY),
        week: useDiaryWeek("2026-10-12"),
        recent: useRecentFoods(),
        log: useLogEntries(),
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

    await act(() => result.current.log.mutateAsync(plate));

    await waitFor(() => {
      expect(fake.requests.dayReads).toBe(before.dayReads + 1);
      expect(fake.requests.dayLogReads).toBe(before.dayLogReads + 2);
      expect(fake.requests.recentReads).toBe(before.recentReads + 1);
    });
  });

  describe("when the write fails", () => {
    it("should expose the error, store nothing and leave the cache as it was", async () => {
      const fake = installDiaryFake(server);
      const { queryClient, wrapper } = createWrapper();
      const { result } = renderHook(() => ({ day: useDiaryDay(DAY), log: useLogEntries() }), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.day.isSuccess).toBe(true);
      });
      fake.failWrites();

      await act(async () => {
        await result.current.log.mutateAsync(plate).catch(() => undefined);
      });

      expect(result.current.log.error).toHaveProperty(
        "message",
        "Could not log the entries (XX000)",
      );
      expect(fake.rows).toEqual([]);
      expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({ entries: [] });
    });

    it("should still refresh the diary, since a lost response may have stored the rows", async () => {
      const fake = installDiaryFake(server);
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => ({ day: useDiaryDay(DAY), log: useLogEntries() }), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.day.isSuccess).toBe(true);
      });
      const dayReadsBefore = fake.requests.dayReads;
      fake.failWrites();

      await act(async () => {
        await result.current.log.mutateAsync(plate).catch(() => undefined);
      });

      await waitFor(() => {
        expect(fake.requests.dayReads).toBe(dayReadsBefore + 1);
      });
    });
  });

  it("should send nothing when a row has a negative amount", async () => {
    const fake = installDiaryFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogEntries(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync([oatsInGrams(50), oatsInGrams(-1)]).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(RangeError);
    });
    expect(fake.requests.writes).toBe(0);
  });
});
