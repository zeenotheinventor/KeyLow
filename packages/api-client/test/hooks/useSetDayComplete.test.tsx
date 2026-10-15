import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { useSetDayComplete } from "../../src/hooks/useSetDayComplete";
import { keys } from "../../src/queryKeys";
import { answerDayLogs } from "../support/dayLogsServer";
import { dayLogRow, dayTotalsRow } from "../support/diary";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

import type { DiaryDay, DiaryWeekDay } from "../../src/repos/diary";
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

const WEDNESDAY = "2026-10-14";

const weekWith = (dayLog: DiaryWeekDay["dayLog"]): DiaryWeekDay[] =>
  [
    "2026-10-12",
    "2026-10-13",
    WEDNESDAY,
    "2026-10-15",
    "2026-10-16",
    "2026-10-17",
    "2026-10-18",
  ].map((localDate) => ({
    localDate,
    dayLog: localDate === WEDNESDAY ? dayLog : null,
    totals: null,
  }));

const dayWith = (dayLog: DiaryDay["dayLog"]): DiaryDay => ({
  localDate: WEDNESDAY,
  entries: [],
  dayLog,
  totals: dayTotalsRow({ local_date: WEDNESDAY }),
});

const isInvalidated = (queryClient: QueryClient, queryKey: readonly unknown[]) =>
  queryClient.getQueryState(queryKey)?.isInvalidated;

const wednesdayInTheWeekCache = (queryClient: QueryClient) =>
  queryClient.getQueryData<DiaryWeekDay[]>(keys.diary.week("2026-10-12"))?.[2];

describe("useSetDayComplete", () => {
  it("should write the completion of the day", async () => {
    const { handlers, writes } = answerDayLogs({ existingDays: [WEDNESDAY] });
    server.use(...handlers);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSetDayComplete(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ localDate: WEDNESDAY, complete: true });
    });

    expect(writes[0]?.body).toMatchObject({ is_complete: true });
  });

  it("should refresh the week the day is in, the day and the month's complete days", async () => {
    const { handlers } = answerDayLogs({ existingDays: [WEDNESDAY] });
    server.use(...handlers);
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.diary.week("2026-10-12"), weekWith(null));
    queryClient.setQueryData(keys.diary.week("2026-10-19"), []);
    queryClient.setQueryData(keys.diary.day(WEDNESDAY), dayWith(null));
    queryClient.setQueryData(keys.diary.completeDays("2026-10"), []);
    const { result } = renderHook(() => useSetDayComplete(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ localDate: WEDNESDAY, complete: true });
    });

    await waitFor(() => {
      expect(isInvalidated(queryClient, keys.diary.week("2026-10-12"))).toBe(true);
    });
    expect(isInvalidated(queryClient, keys.diary.day(WEDNESDAY))).toBe(true);
    expect(isInvalidated(queryClient, keys.diary.completeDays("2026-10"))).toBe(true);
    expect(isInvalidated(queryClient, keys.diary.week("2026-10-19"))).toBe(false);
  });

  it("should show the day complete in the cached week and day before the request answers", async () => {
    const { handlers } = answerDayLogs({ existingDays: [WEDNESDAY] });
    // The request is held, so what the cache shows is the optimistic value alone.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.patch(`${REST_URL}/day_logs`, async () => {
        await held;
        return postgrestError(500, "XX000", "held");
      }),
      ...handlers,
    );
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.diary.week("2026-10-12"), weekWith(null));
    queryClient.setQueryData(keys.diary.day(WEDNESDAY), dayWith(null));
    const { result } = renderHook(() => useSetDayComplete(), { wrapper });

    act(() => {
      result.current.mutate({ localDate: WEDNESDAY, complete: true });
    });

    await waitFor(() => {
      expect(wednesdayInTheWeekCache(queryClient)?.dayLog?.is_complete).toBe(true);
    });
    expect(queryClient.getQueryData<DiaryDay>(keys.diary.day(WEDNESDAY))?.dayLog?.is_complete).toBe(
      true,
    );
    release();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("should keep the note of a day log while completing it", async () => {
    const { handlers } = answerDayLogs({ existingDays: [WEDNESDAY] });
    server.use(...handlers);
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(
      keys.diary.week("2026-10-12"),
      weekWith(
        dayLogRow({
          local_date: WEDNESDAY,
          is_complete: false,
          completed_at: null,
          note: "Long run",
        }),
      ),
    );
    const { result } = renderHook(() => useSetDayComplete(), { wrapper });

    act(() => {
      result.current.mutate({ localDate: WEDNESDAY, complete: true });
    });

    await waitFor(() => {
      expect(wednesdayInTheWeekCache(queryClient)?.dayLog).toMatchObject({
        is_complete: true,
        note: "Long run",
      });
    });
  });

  it("should put the cached week back when the write fails", async () => {
    server.use(http.patch(`${REST_URL}/day_logs`, () => postgrestError(500, "XX000", "boom")));
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.diary.week("2026-10-12"), weekWith(null));
    queryClient.setQueryData(keys.diary.day(WEDNESDAY), dayWith(null));
    const { result } = renderHook(() => useSetDayComplete(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ localDate: WEDNESDAY, complete: true })
        .catch(() => undefined);
    });

    expect(wednesdayInTheWeekCache(queryClient)?.dayLog).toBeNull();
    expect(queryClient.getQueryData<DiaryDay>(keys.diary.day(WEDNESDAY))?.dayLog).toBeNull();
  });

  it("should show a completed day incomplete again, with no completion time", async () => {
    const { handlers } = answerDayLogs({ existingDays: [WEDNESDAY] });
    server.use(...handlers);
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(
      keys.diary.week("2026-10-12"),
      weekWith(dayLogRow({ local_date: WEDNESDAY })),
    );
    const { result } = renderHook(() => useSetDayComplete(), { wrapper });

    act(() => {
      result.current.mutate({ localDate: WEDNESDAY, complete: false });
    });

    await waitFor(() => {
      expect(wednesdayInTheWeekCache(queryClient)?.dayLog).toMatchObject({
        is_complete: false,
        completed_at: null,
      });
    });
  });

  it("should run quick toggles one after the other, so the last one is what the server keeps", async () => {
    let requestsSeen = 0;
    let completeOnServer: boolean | undefined;
    server.use(
      http.patch(`${REST_URL}/day_logs`, async ({ request }) => {
        requestsSeen += 1;
        const { is_complete } = z.object({ is_complete: z.boolean() }).parse(await request.json());
        // The answer to marking complete (the first tap) is slow. Run side by side with the second
        // tap, it would land last and overwrite it.
        await delay(is_complete ? 150 : 0);
        completeOnServer = is_complete;
        return postgrestRows(request, [{ local_date: WEDNESDAY }]);
      }),
    );
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useSetDayComplete(), { wrapper });

    act(() => {
      result.current.mutate({ localDate: WEDNESDAY, complete: true });
      result.current.mutate({ localDate: WEDNESDAY, complete: false });
    });

    await waitFor(() => {
      expect(requestsSeen).toBe(2);
      expect(queryClient.isMutating()).toBe(0);
    });
    expect(completeOnServer).toBe(false);
  });
});
