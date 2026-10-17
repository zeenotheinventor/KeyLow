import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { useDiaryDay } from "../../src/hooks/useDiaryDay";
import { useDiaryWeek } from "../../src/hooks/useDiaryWeek";
import { useLogRecipeServing } from "../../src/hooks/useLogRecipeServing";
import { keys } from "../../src/queryKeys";
import { foodEntryRow } from "../support/diary";
import { installDiaryFake } from "../support/diaryFake";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { RECIPE_DAY, recipeEntryRow, servingInput } from "../support/recipeEntries";
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

/**
 * The diary fake's insert only knows food and quick entries, which is the point of this ticket, so a
 * recipe insert gets its own answer, laid over the fake's. The fake keeps answering the reads.
 */
function answerRecipeInsert(outcome: "stored" | "fails") {
  const requests = { inserts: 0 };
  server.use(
    http.post(`${REST_URL}/food_log_entries`, ({ request }) => {
      requests.inserts += 1;
      return outcome === "stored"
        ? postgrestRows(request, [recipeEntryRow()], 201)
        : postgrestError(500, "XX000", "unavailable");
    }),
  );
  return requests;
}

describe("useLogRecipeServing", () => {
  it("should insert the entry and resolve to the stored row", async () => {
    installDiaryFake(server);
    const requests = answerRecipeInsert("stored");
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogRecipeServing(), { wrapper });

    const entry = await act(() => result.current.mutateAsync(servingInput));

    expect(entry).toEqual(recipeEntryRow());
    expect(requests.inserts).toBe(1);
  });

  it("should throw a RangeError and ask for nothing when the amount is not valid", async () => {
    installDiaryFake(server);
    const requests = answerRecipeInsert("stored");
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogRecipeServing(), { wrapper });

    const failure = await act(() =>
      result.current
        .mutateAsync({ ...servingInput, quantity: -1 })
        .catch((error: unknown) => error),
    );

    expect(failure).toBeInstanceOf(RangeError);
    expect(requests.inserts).toBe(0);
  });

  it("should write no query data itself, not the day and not the entry", async () => {
    const fake = installDiaryFake(server, [foodEntryRow({ local_date: RECIPE_DAY })]);
    answerRecipeInsert("stored");
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ day: useDiaryDay(RECIPE_DAY), log: useLogRecipeServing() }),
      {
        wrapper,
      },
    );
    await waitFor(() => {
      expect(result.current.day.isSuccess).toBe(true);
    });
    const dayBefore = queryClient.getQueryData(keys.diary.day(RECIPE_DAY));
    const writeToCache = vi.spyOn(queryClient, "setQueryData");
    const writeToCaches = vi.spyOn(queryClient, "setQueriesData");
    const releaseReads = fake.holdReads();

    await act(() => result.current.log.mutateAsync(servingInput));

    expect(writeToCache).not.toHaveBeenCalled();
    expect(writeToCaches).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(keys.diary.day(RECIPE_DAY))).toBe(dayBefore);
    releaseReads();
  });

  it("should refresh the day and the week once the insert settles", async () => {
    const fake = installDiaryFake(server);
    answerRecipeInsert("stored");
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        day: useDiaryDay(RECIPE_DAY),
        week: useDiaryWeek("2026-10-12"),
        log: useLogRecipeServing(),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.day.isSuccess && result.current.week.isSuccess).toBe(true);
    });
    const before = { ...fake.requests };

    await act(() => result.current.log.mutateAsync(servingInput));

    await waitFor(() => {
      expect(fake.requests.dayReads).toBe(before.dayReads + 1);
      expect(fake.requests.dayLogReads).toBe(before.dayLogReads + 2);
    });
  });

  it("should expose the error, leave the cache as it was and still refresh when the insert fails", async () => {
    const fake = installDiaryFake(server, [foodEntryRow({ local_date: RECIPE_DAY })]);
    answerRecipeInsert("fails");
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ day: useDiaryDay(RECIPE_DAY), log: useLogRecipeServing() }),
      {
        wrapper,
      },
    );
    await waitFor(() => {
      expect(result.current.day.isSuccess).toBe(true);
    });
    const dayBefore = queryClient.getQueryData(keys.diary.day(RECIPE_DAY));
    const readsBefore = fake.requests.dayReads;

    await act(async () => {
      await result.current.log.mutateAsync(servingInput).catch(() => undefined);
    });

    expect(result.current.log.error).toHaveProperty("message", "Could not log the recipe (XX000)");
    // A lost response may still have stored the row, so the day is read again even after a failure.
    await waitFor(() => {
      expect(fake.requests.dayReads).toBe(readsBefore + 1);
    });
    expect(queryClient.getQueryData(keys.diary.day(RECIPE_DAY))).toEqual(dayBefore);
  });
});
