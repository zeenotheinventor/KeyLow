import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDeleteEntry } from "../../src/hooks/useDeleteEntry";
import { useDiaryDay } from "../../src/hooks/useDiaryDay";
import { useRecentFoods } from "../../src/hooks/useRecentFoods";
import { keys } from "../../src/queryKeys";
import { foodEntryRow } from "../support/diary";
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

const DAY = "2026-10-15";
const breakfast = foodEntryRow({
  id: "44444444-4444-4444-8444-444444444441",
  local_date: DAY,
  logged_at: `${DAY}T08:00:00+00:00`,
});
const lunch = foodEntryRow({
  id: "44444444-4444-4444-8444-444444444442",
  local_date: DAY,
  logged_at: `${DAY}T12:00:00+00:00`,
});

const renderDay = async (fake: ReturnType<typeof installDiaryFake>) => {
  const rendered = createWrapper();
  const hook = renderHook(
    () => ({ day: useDiaryDay(DAY), recent: useRecentFoods(), remove: useDeleteEntry() }),
    { wrapper: rendered.wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.day.isSuccess && hook.result.current.recent.isSuccess).toBe(true);
  });
  return { ...rendered, ...hook, fake };
};

describe("useDeleteEntry", () => {
  it("should soft delete the entry and leave the other one", async () => {
    const fake = installDiaryFake(server, [breakfast, lunch]);
    const { result } = await renderDay(fake);

    await act(() => result.current.remove.mutateAsync(breakfast));

    expect(fake.rows.map((row) => [row.id, row.deleted_at === null])).toEqual([
      [breakfast.id, false],
      [lunch.id, true],
    ]);
  });

  it("should take the entry out of the day at once, while the request is still on its way", async () => {
    const fake = installDiaryFake(server, [breakfast, lunch]);
    const { queryClient, result } = await renderDay(fake);
    const releaseWrites = fake.holdWrites();

    act(() => {
      result.current.remove.mutate(breakfast);
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
        entries: [{ id: lunch.id }],
      });
    });
    expect(result.current.remove.isPending).toBe(true);
    releaseWrites();
    await waitFor(() => {
      expect(result.current.remove.isSuccess).toBe(true);
    });
  });

  it("should not let a read that was already on its way bring the entry back", async () => {
    const fake = installDiaryFake(server, [breakfast, lunch]);
    const { queryClient, result } = await renderDay(fake);
    const releaseReads = fake.holdReads();
    const releaseWrites = fake.holdWrites();
    act(() => {
      void queryClient.refetchQueries({ queryKey: keys.diary.day(DAY) });
    });
    act(() => {
      result.current.remove.mutate(breakfast);
    });

    // The old read lands while the delete is still on its way, with the entry in it.
    releaseReads();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ id: lunch.id }],
    });
    releaseWrites();
    await waitFor(() => {
      expect(result.current.remove.isSuccess).toBe(true);
    });
  });

  it("should put the entry back in its place when the request fails", async () => {
    const fake = installDiaryFake(server, [breakfast, lunch]);
    const { queryClient, result } = await renderDay(fake);
    fake.failWrites();
    const releaseReads = fake.holdReads();

    await act(async () => {
      await result.current.remove.mutateAsync(breakfast).catch(() => undefined);
    });

    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ id: breakfast.id }, { id: lunch.id }],
    });
    releaseReads();
  });

  describe("the entry that was opened on its own", () => {
    it("should be gone from the cache at once, while the request is still on its way", async () => {
      const fake = installDiaryFake(server, [breakfast, lunch]);
      const { queryClient, result } = await renderDay(fake);
      queryClient.setQueryData(keys.diary.entry(breakfast.id), breakfast);
      const releaseWrites = fake.holdWrites();

      act(() => {
        result.current.remove.mutate(breakfast);
      });

      await waitFor(() => {
        expect(queryClient.getQueryData(keys.diary.entry(breakfast.id))).toBeNull();
      });
      expect(result.current.remove.isPending).toBe(true);
      releaseWrites();
      await waitFor(() => {
        expect(result.current.remove.isSuccess).toBe(true);
      });
    });

    it("should leave the other entry that was opened alone", async () => {
      const fake = installDiaryFake(server, [breakfast, lunch]);
      const { queryClient, result } = await renderDay(fake);
      queryClient.setQueryData(keys.diary.entry(breakfast.id), breakfast);
      queryClient.setQueryData(keys.diary.entry(lunch.id), lunch);

      await act(() => result.current.remove.mutateAsync(breakfast));

      expect(queryClient.getQueryData(keys.diary.entry(lunch.id))).toEqual(lunch);
    });

    it("should not be added to the cache when it was never opened", async () => {
      const fake = installDiaryFake(server, [breakfast, lunch]);
      const { queryClient, result } = await renderDay(fake);

      await act(() => result.current.remove.mutateAsync(breakfast));

      expect(queryClient.getQueryCache().find({ queryKey: keys.diary.entry(breakfast.id) })).toBe(
        undefined,
      );
    });

    it("should be back in the cache when the request fails", async () => {
      const fake = installDiaryFake(server, [breakfast, lunch]);
      const { queryClient, result } = await renderDay(fake);
      queryClient.setQueryData(keys.diary.entry(breakfast.id), breakfast);
      fake.failWrites();
      const releaseReads = fake.holdReads();

      await act(async () => {
        await result.current.remove.mutateAsync(breakfast).catch(() => undefined);
      });

      expect(queryClient.getQueryData(keys.diary.entry(breakfast.id))).toEqual(breakfast);
      releaseReads();
    });
  });

  it("should refresh the day and the recent foods, so the food falls out of the recent list", async () => {
    const fake = installDiaryFake(server, [breakfast]);
    const { result } = await renderDay(fake);
    expect(result.current.recent.data).toHaveLength(1);

    await act(() => result.current.remove.mutateAsync(breakfast));

    await waitFor(() => {
      expect(result.current.recent.data).toEqual([]);
    });
    expect(result.current.day.data?.entries).toEqual([]);
  });

  it("should expose the error when the entry cannot be found", async () => {
    const fake = installDiaryFake(server, []);
    const { result } = await renderDay(fake);

    await act(async () => {
      await result.current.remove.mutateAsync(breakfast).catch(() => undefined);
    });

    expect(result.current.remove.error?.message).toBe(`The entry ${breakfast.id} was not found`);
  });
});
