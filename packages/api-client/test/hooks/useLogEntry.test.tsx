import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDeleteEntry } from "../../src/hooks/useDeleteEntry";
import { useLogEntry } from "../../src/hooks/useLogEntry";
import { useRestoreEntry } from "../../src/hooks/useRestoreEntry";
import { useUpdateEntry } from "../../src/hooks/useUpdateEntry";
import { keys } from "../../src/queryKeys";
import { foodEntryRow, quickEntryRow } from "../support/diary";
import { installDiaryFake } from "../support/diaryFake";
import { createWrapper } from "../support/wrapper";

import type { DiaryDay } from "../../src/repos/diary";

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
const crisps = quickEntryRow({ local_date: DAY, logged_at: `${DAY}T11:45:00+00:00` });
const oats = foodEntryRow({ local_date: DAY, logged_at: `${DAY}T08:30:00+00:00` });

const cachedDay = (entries: DiaryDay["entries"]): DiaryDay => ({
  localDate: DAY,
  entries,
  dayLog: null,
  totals: null,
});

describe("useLogEntry", () => {
  it("should load the entry with that id", async () => {
    const fake = installDiaryFake(server, [oats, crisps]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLogEntry(crisps.id), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(crisps);
    expect(fake.requests.entryReads).toBe(1);
  });

  it("should resolve to null for an entry that does not exist", async () => {
    installDiaryFake(server, [oats]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLogEntry(crisps.id), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it("should cache the entry under its own key", async () => {
    installDiaryFake(server, [crisps]);
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useLogEntry(crisps.id), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.diary.entry(crisps.id))).toEqual(crisps);
  });

  it("should make no request while enabled is false", async () => {
    const fake = installDiaryFake(server, [crisps]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLogEntry(crisps.id, { enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests.entryReads).toBe(0);
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("should start from the entry in a cached day, so a row that was tapped opens at once", () => {
    installDiaryFake(server, [crisps]);
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.diary.day(DAY), cachedDay([oats, crisps]));

    const { result } = renderHook(() => useLogEntry(crisps.id), { wrapper });

    expect(result.current.data).toEqual(crisps);
  });

  it("should not start from an entry of a day that is cached without it", () => {
    installDiaryFake(server, [crisps]);
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.diary.day(DAY), cachedDay([oats]));

    const { result } = renderHook(() => useLogEntry(crisps.id), { wrapper });

    expect(result.current.data).toBeUndefined();
  });

  describe("after a write", () => {
    it("should show the entry as the update stored it, in the screen that is open", async () => {
      installDiaryFake(server, [crisps]);
      const { result } = (() => {
        const rendered = createWrapper();
        return renderHook(() => ({ entry: useLogEntry(crisps.id), update: useUpdateEntry() }), {
          wrapper: rendered.wrapper,
        });
      })();
      await waitFor(() => {
        expect(result.current.entry.isSuccess).toBe(true);
      });

      await act(() =>
        result.current.update.mutateAsync({
          entry: crisps,
          time: { loggedAt: `${NEXT_DAY}T00:30:00.000Z`, timeZone: "UTC" },
        }),
      );

      await waitFor(() => {
        expect(result.current.entry.data?.logged_at).toBe(`${NEXT_DAY}T00:30:00.000Z`);
      });
      expect(result.current.entry.data?.local_date).toBe(NEXT_DAY);
    });

    it("should read the entry again once it was deleted, and find it gone", async () => {
      const fake = installDiaryFake(server, [crisps]);
      const rendered = createWrapper();
      const { result } = renderHook(
        () => ({ entry: useLogEntry(crisps.id), remove: useDeleteEntry() }),
        { wrapper: rendered.wrapper },
      );
      await waitFor(() => {
        expect(result.current.entry.isSuccess).toBe(true);
      });

      await act(() => result.current.remove.mutateAsync(crisps));

      await waitFor(() => {
        expect(rendered.queryClient.getQueryData(keys.diary.entry(crisps.id))).toBeNull();
      });
      expect(fake.requests.entryReads).toBeGreaterThanOrEqual(2);
    });

    it("should have the entry back after Undo", async () => {
      installDiaryFake(server, [crisps]);
      const rendered = createWrapper();
      const { result } = renderHook(
        () => ({
          entry: useLogEntry(crisps.id),
          remove: useDeleteEntry(),
          restore: useRestoreEntry(),
        }),
        { wrapper: rendered.wrapper },
      );
      await waitFor(() => {
        expect(result.current.entry.isSuccess).toBe(true);
      });
      await act(() => result.current.remove.mutateAsync(crisps));
      await waitFor(() => {
        expect(rendered.queryClient.getQueryData(keys.diary.entry(crisps.id))).toBeNull();
      });

      await act(() => result.current.restore.mutateAsync(crisps));

      await waitFor(() => {
        expect(rendered.queryClient.getQueryData(keys.diary.entry(crisps.id))).toEqual(crisps);
      });
    });
  });
});
