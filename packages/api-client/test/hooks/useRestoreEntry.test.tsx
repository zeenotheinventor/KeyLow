import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDeleteEntry } from "../../src/hooks/useDeleteEntry";
import { useDiaryDay } from "../../src/hooks/useDiaryDay";
import { useRestoreEntry } from "../../src/hooks/useRestoreEntry";
import { keys } from "../../src/queryKeys";
import { foodEntryRow } from "../support/diary";
import { installDiaryFake } from "../support/diaryFake";
import { recipeEntryRow, servingInput } from "../support/recipeEntries";
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

const renderDay = async () => {
  const fake = installDiaryFake(server, [breakfast, lunch]);
  const rendered = createWrapper();
  const hook = renderHook(
    () => ({ day: useDiaryDay(DAY), remove: useDeleteEntry(), restore: useRestoreEntry() }),
    { wrapper: rendered.wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.day.isSuccess).toBe(true);
  });
  // The entry was opened on its own before it was deleted, so the cache holds it under its own key too.
  rendered.queryClient.setQueryData(keys.diary.entry(breakfast.id), breakfast);
  await act(() => hook.result.current.remove.mutateAsync(breakfast));
  await waitFor(() => {
    expect(hook.result.current.day.data?.entries).toHaveLength(1);
  });
  return { ...rendered, ...hook, fake };
};

describe("useRestoreEntry", () => {
  it("should bring a deleted recipe entry back into its day, in time order, with nothing in it changed", async () => {
    const dinner = recipeEntryRow({ ...servingInput });
    const fake = installDiaryFake(server, [breakfast, dinner]);
    const rendered = createWrapper();
    const { result } = renderHook(
      () => ({ day: useDiaryDay(DAY), remove: useDeleteEntry(), restore: useRestoreEntry() }),
      { wrapper: rendered.wrapper },
    );
    await waitFor(() => {
      expect(result.current.day.isSuccess).toBe(true);
    });
    await act(() => result.current.remove.mutateAsync(dinner));
    await waitFor(() => {
      expect(result.current.day.data?.entries).toHaveLength(1);
    });

    await act(() => result.current.restore.mutateAsync(dinner));

    await waitFor(() => {
      expect(result.current.day.data?.entries).toEqual([breakfast, dinner]);
    });
    expect(fake.rows.find(({ id }) => id === dinner.id)?.deleted_at).toBeNull();
  });

  it("should clear deleted_at, so the entry is in the day again", async () => {
    const { fake, result } = await renderDay();

    await act(() => result.current.restore.mutateAsync(breakfast));

    expect(fake.rows.find((row) => row.id === breakfast.id)?.deleted_at).toBeNull();
    await waitFor(() => {
      expect(result.current.day.data?.entries.map((entry) => entry.id)).toEqual([
        breakfast.id,
        lunch.id,
      ]);
    });
  });

  it("should put the entry back in its place in the day at once, while the request is on its way", async () => {
    const { fake, queryClient, result } = await renderDay();
    const releaseWrites = fake.holdWrites();

    act(() => {
      result.current.restore.mutate(breakfast);
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
        entries: [{ id: breakfast.id }, { id: lunch.id }],
      });
    });
    expect(result.current.restore.isPending).toBe(true);
    releaseWrites();
    await waitFor(() => {
      expect(result.current.restore.isSuccess).toBe(true);
    });
  });

  it("should take the entry out again when the request fails", async () => {
    const { fake, queryClient, result } = await renderDay();
    fake.failWrites();
    fake.holdReads();

    await act(async () => {
      await result.current.restore.mutateAsync(breakfast).catch(() => undefined);
    });

    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ id: lunch.id }],
    });
  });

  describe("the entry that was opened on its own", () => {
    it("should be back in the cache at once, while the request is on its way", async () => {
      const { fake, queryClient, result } = await renderDay();
      expect(queryClient.getQueryData(keys.diary.entry(breakfast.id))).toBeNull();
      const releaseWrites = fake.holdWrites();

      act(() => {
        result.current.restore.mutate(breakfast);
      });

      await waitFor(() => {
        expect(queryClient.getQueryData(keys.diary.entry(breakfast.id))).toEqual(breakfast);
      });
      releaseWrites();
      await waitFor(() => {
        expect(result.current.restore.isSuccess).toBe(true);
      });
    });

    it("should be gone from the cache again when the request fails", async () => {
      const { fake, queryClient, result } = await renderDay();
      fake.failWrites();
      fake.holdReads();

      await act(async () => {
        await result.current.restore.mutateAsync(breakfast).catch(() => undefined);
      });

      expect(queryClient.getQueryData(keys.diary.entry(breakfast.id))).toBeNull();
    });
  });

  it("should send the restore only after a delete still on its way has settled, and end with the entry visible", async () => {
    const fake = installDiaryFake(server, [breakfast, lunch]);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ day: useDiaryDay(DAY), remove: useDeleteEntry(), restore: useRestoreEntry() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.day.isSuccess).toBe(true);
    });
    const releaseWrites = fake.holdWrites();

    act(() => {
      result.current.remove.mutate(breakfast);
    });
    await waitFor(() => {
      expect(fake.requests.writes).toBe(1);
    });
    act(() => {
      result.current.restore.mutate(breakfast);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The Undo is queued behind the delete: no second request yet.
    expect(fake.requests.writes).toBe(1);
    releaseWrites();
    await waitFor(() => {
      expect(result.current.restore.isSuccess).toBe(true);
    });
    expect(fake.requests.writes).toBe(2);
    expect(fake.rows.find((row) => row.id === breakfast.id)?.deleted_at).toBeNull();
    await waitFor(() => {
      expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
        entries: [{ id: breakfast.id }, { id: lunch.id }],
      });
    });
  });
});
