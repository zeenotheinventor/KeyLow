import { dehydrate, hydrate, onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useHistory } from "../../src/hooks/useHistory";
import { useHistoryWeek } from "../../src/hooks/useHistoryWeek";
import { KeyLowProvider } from "../../src/KeyLowProvider";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import { goldenRoutine } from "../support/goldenWeekRows";
import {
  goldenHistorySessions,
  installHistoryFake,
  madeUpEarlierWeek,
  repeatedGoldenWeeks,
} from "../support/history";
import { createQueryClient } from "../support/queryClients";
import { createWrapper } from "../support/wrapper";

import type { DehydratedState } from "@tanstack/react-query";
import type { ReactNode } from "react";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

// What a persister does to a cache: it goes to storage as text and comes back as the same plain data.
const throughStorage = <Value,>(value: Value): Value =>
  // A cache holds plain JSON data only, which the text form keeps exactly.
  JSON.parse(JSON.stringify(value)) as Value;

/** Every property name anywhere in a stored value. */
const namesIn = (value: unknown): string[] =>
  typeof value !== "object" || value === null
    ? []
    : Object.entries(value).flatMap(([name, inner]) => [name, ...namesIn(inner)]);

const DERIVED_NAMES = [
  "summary",
  "workingSets",
  "warmupSets",
  "durationMinutes",
  "topMuscles",
  "titleSource",
  "sessionCount",
  "workingSetTotal",
];

const twoWeeks = [...madeUpEarlierWeek, ...goldenHistorySessions];

/** The stored queries of the history family, by what the mobile cache keeps: the keys under the history prefix. */
const historyQueriesOf = (stored: DehydratedState) =>
  stored.queries.filter(({ queryKey }) => queryKey[0] === "training" && queryKey[1] === "history");

describe("the history reads in a persisted cache", () => {
  const openOnline = async () => {
    const fake = installHistoryFake(server, { sessions: twoWeeks, routine: goldenRoutine });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ list: useHistory({ weeks: 2 }), week: useHistoryWeek("2026-10-12") }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(2);
      expect(result.current.week.data).toHaveLength(3);
    });
    return {
      fake,
      shown: { list: result.current.list.data, week: result.current.week.data },
      stored: throughStorage(dehydrate(queryClient)),
    };
  };

  const restoreOffline = (stored: DehydratedState) => {
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, stored);
    onlineManager.setOnline(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );
    return { wrapper };
  };

  it("should store the list and each week under keys of the history prefix with a date or a fixed word", async () => {
    const { stored } = await openOnline();

    expect(historyQueriesOf(stored).map(({ queryKey }) => queryKey)).toEqual(
      expect.arrayContaining([keys.training.historyList, keys.training.history("2026-10-12")]),
    );
  });

  it("should store rows only: no summary, count, duration, muscle ranking or comparison", async () => {
    const { stored } = await openOnline();

    for (const { state } of historyQueriesOf(stored)) {
      for (const derived of DERIVED_NAMES) {
        expect(namesIn(state)).not.toContain(derived);
      }
    }
  });

  it("should give back the stored weeks and the same summaries with the network down, asking for nothing", async () => {
    const { fake, shown, stored } = await openOnline();
    const requestsBefore = fake.requests.length;
    fake.goOffline();
    const { wrapper } = restoreOffline(stored);

    const { result } = renderHook(
      () => ({ list: useHistory({ weeks: 2 }), week: useHistoryWeek("2026-10-12") }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.list.data).toBeDefined();
      expect(result.current.week.data).toBeDefined();
    });
    expect(result.current.list.data).toEqual(throughStorage(shown.list));
    expect(result.current.week.data).toEqual(throughStorage(shown.week));
    expect(result.current.list.data?.map((week) => [week.weekStart, week.sessionCount])).toEqual([
      ["2026-10-12", 3],
      ["2026-10-05", 4],
    ]);
    expect(fake.requests).toHaveLength(requestsBefore);
  });
});

describe("a week of the history stored without the routine", () => {
  it("should show the summaries with no plan comparison offline instead of staying pending", async () => {
    const fake = installHistoryFake(server, {
      sessions: goldenHistorySessions,
      routine: goldenRoutine,
    });
    const online = createWrapper();
    const first = renderHook(() => useHistoryWeek("2026-10-12"), { wrapper: online.wrapper });
    await waitFor(() => {
      expect(first.result.current.data).toHaveLength(3);
    });
    const stored = throughStorage(dehydrate(online.queryClient));
    const onlyTheRows: DehydratedState = {
      ...stored,
      queries: historyQueriesOf(stored),
    };
    fake.goOffline();
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, onlyTheRows);
    onlineManager.setOnline(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );

    const { result } = renderHook(() => useHistoryWeek("2026-10-12"), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(3);
    });
    expect(result.current.data?.map(({ summary }) => summary.titleSource)).toEqual([
      "Legs",
      "Pull",
      "Push",
    ]);
  });
});

describe("the size of the stored history", () => {
  const SIZE_LIMIT_BYTES = 300 * 1024;

  const storedHistoryBytes = async (sessions: Record<string, unknown>[], withWeeks: boolean) => {
    installHistoryFake(server, { sessions, routine: goldenRoutine });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        list: useHistory({ weeks: 4 }),
        week: useHistoryWeek("2026-10-12", { enabled: withWeeks }),
        week2: useHistoryWeek("2026-10-05", { enabled: withWeeks }),
        week3: useHistoryWeek("2026-09-28", { enabled: withWeeks }),
        week4: useHistoryWeek("2026-09-21", { enabled: withWeeks }),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(4);
      if (withWeeks) {
        expect(result.current.week4.data).toHaveLength(3);
      }
    });
    return JSON.stringify(historyQueriesOf(dehydrate(queryClient))).length;
  };

  it("should be under 300 KB for the golden week repeated for four weeks (a heavy user's list)", async () => {
    const bytes = await storedHistoryBytes(repeatedGoldenWeeks(4), false);

    expect(bytes).toBeLessThan(SIZE_LIMIT_BYTES);
  });

  it("should be under 300 KB when the same four weeks are also read week by week", async () => {
    const bytes = await storedHistoryBytes(repeatedGoldenWeeks(4), true);

    expect(bytes).toBeLessThan(SIZE_LIMIT_BYTES);
  });

  it("should be under 300 KB for a heavier user: the golden week twice a week for four weeks, 360 sets", async () => {
    const bytes = await storedHistoryBytes(repeatedGoldenWeeks(4, 2), false);

    expect(bytes).toBeLessThan(SIZE_LIMIT_BYTES);
  });
});
