import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDiaryDay } from "../../src/hooks/useDiaryDay";
import { useQuickAdd } from "../../src/hooks/useQuickAdd";
import { keys } from "../../src/queryKeys";
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
const cake = { kcal: 300, label: "Office cake", loggedAt: `${DAY}T15:30:00.000Z`, localDate: DAY };

describe("useQuickAdd", () => {
  it("should store a quick entry at the given time and resolve to it", async () => {
    const fake = installDiaryFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useQuickAdd(), { wrapper });

    const entry = await act(() => result.current.mutateAsync(cake));

    expect(entry).toMatchObject({
      item_type: "quick",
      local_date: DAY,
      food_id: null,
      nutrients: { kcal: 300 },
      snapshot: { kind: "quick", label: "Office cake" },
    });
    expect(fake.rows.map((row) => row.id)).toEqual([entry.id]);
    expect(JSON.stringify(fake.rows)).not.toMatch(/slot/i);
  });

  it("should show the entry in its day at once, before the day is read again", async () => {
    const fake = installDiaryFake(server);
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => ({ day: useDiaryDay(DAY), add: useQuickAdd() }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.day.isSuccess).toBe(true);
    });
    fake.holdReads();

    const entry = await act(() => result.current.add.mutateAsync(cake));

    expect(queryClient.getQueryData(keys.diary.day(DAY))).toMatchObject({
      entries: [{ id: entry.id }],
    });
  });

  it("should expose the error and store nothing when the day is not a calendar date", async () => {
    const fake = installDiaryFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useQuickAdd(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ...cake, localDate: "2026-02-30" }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(fake.requests.writes).toBe(0);
  });
});
