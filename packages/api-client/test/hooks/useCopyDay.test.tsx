import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useCopyDay } from "../../src/hooks/useCopyDay";
import { useUndoCopyDay } from "../../src/hooks/useUndoCopyDay";
import { keys } from "../../src/queryKeys";
import { answerCopyDay, copiedId } from "../support/copyDayServer";
import { foodEntryRow } from "../support/diary";
import { createWrapper } from "../support/wrapper";

import type { QueryClient } from "@tanstack/react-query";

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

const copyInput = { from: "2026-10-14", to: "2026-10-15", timeZone: "Europe/London" };

const isInvalidated = (queryClient: QueryClient, queryKey: readonly unknown[]) =>
  queryClient.getQueryState(queryKey)?.isInvalidated;

/** Seeds the caches a copy onto 15 October touches, and some it must leave alone. */
function seedDiaryCaches(queryClient: QueryClient) {
  const seeded = [
    keys.diary.day("2026-10-15"),
    keys.diary.day("2026-10-14"),
    keys.diary.week("2026-10-12"),
    keys.diary.week("2026-10-05"),
    keys.diary.recentFoods,
    keys.diary.completeDays("2026-10"),
  ];
  for (const queryKey of seeded) {
    queryClient.setQueryData(queryKey, []);
  }
}

describe("useCopyDay", () => {
  it("should resolve to the number of entries copied, for the toast", async () => {
    const { handlers } = answerCopyDay({ sourceEntries: [foodEntryRow(), foodEntryRow()] });
    server.use(...handlers);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCopyDay(), { wrapper });

    const copied = await act(() => result.current.mutateAsync(copyInput));

    expect(copied).toEqual({
      localDate: "2026-10-15",
      count: 2,
      entryIds: [copiedId(1), copiedId(2)],
    });
  });

  it("should refresh the target day, the week it is in and the recent foods", async () => {
    const { handlers } = answerCopyDay({ sourceEntries: [foodEntryRow()] });
    server.use(...handlers);
    const { queryClient, wrapper } = createWrapper();
    seedDiaryCaches(queryClient);
    const { result } = renderHook(() => useCopyDay(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(copyInput);
    });

    await waitFor(() => {
      expect(isInvalidated(queryClient, keys.diary.day("2026-10-15"))).toBe(true);
    });
    expect(isInvalidated(queryClient, keys.diary.week("2026-10-12"))).toBe(true);
    expect(isInvalidated(queryClient, keys.diary.recentFoods)).toBe(true);
  });

  it("should leave the source day, other weeks and the complete days alone", async () => {
    const { handlers } = answerCopyDay({ sourceEntries: [foodEntryRow()] });
    server.use(...handlers);
    const { queryClient, wrapper } = createWrapper();
    seedDiaryCaches(queryClient);
    const { result } = renderHook(() => useCopyDay(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(copyInput);
    });

    expect(isInvalidated(queryClient, keys.diary.day("2026-10-14"))).toBe(false);
    expect(isInvalidated(queryClient, keys.diary.week("2026-10-05"))).toBe(false);
    expect(isInvalidated(queryClient, keys.diary.completeDays("2026-10"))).toBe(false);
  });

  it("should refresh the target day when a copy fails part way, since some rows may have been written", async () => {
    const { handlers } = answerCopyDay({
      sourceEntries: [foodEntryRow(), foodEntryRow()],
      failInsertNumber: 2,
    });
    server.use(...handlers);
    const { queryClient, wrapper } = createWrapper();
    seedDiaryCaches(queryClient);
    const { result } = renderHook(() => useCopyDay(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(copyInput).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(isInvalidated(queryClient, keys.diary.day("2026-10-15"))).toBe(true);
  });
});

describe("useUndoCopyDay", () => {
  const copied = {
    localDate: "2026-10-15",
    count: 2,
    entryIds: [copiedId(1), copiedId(2)],
  };

  it("should remove exactly the copied rows", async () => {
    const { handlers, writes } = answerCopyDay({ sourceEntries: [] });
    server.use(...handlers);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUndoCopyDay(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(copied);
    });

    expect(writes).toHaveLength(1);
    expect(writes[0]?.url.searchParams.get("id")).toBe(`in.(${copiedId(1)},${copiedId(2)})`);
  });

  it("should refresh the target day, the week it is in and the recent foods", async () => {
    const { handlers } = answerCopyDay({ sourceEntries: [] });
    server.use(...handlers);
    const { queryClient, wrapper } = createWrapper();
    seedDiaryCaches(queryClient);
    const { result } = renderHook(() => useUndoCopyDay(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(copied);
    });

    await waitFor(() => {
      expect(isInvalidated(queryClient, keys.diary.day("2026-10-15"))).toBe(true);
    });
    expect(isInvalidated(queryClient, keys.diary.week("2026-10-12"))).toBe(true);
    expect(isInvalidated(queryClient, keys.diary.recentFoods)).toBe(true);
    expect(isInvalidated(queryClient, keys.diary.day("2026-10-14"))).toBe(false);
  });
});
