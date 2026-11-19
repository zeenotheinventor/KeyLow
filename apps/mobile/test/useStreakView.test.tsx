import { KeyLowProvider } from "@keylow/api-client";
import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react-native";

import { useStreakView } from "../lib/streaks";
import { useReadsEnabled } from "../lib/useReadsEnabled";
import { streakStatsClient } from "./support/streakFixtures";

import type { StreakStatsOptions } from "./support/streakFixtures";
import type { PropsWithChildren } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: () => Promise.resolve() },
}));
jest.mock("../lib/useReadsEnabled");
// 13:00 on Thursday 19 November 2026, UTC. A person's yesterday is settled from 12:00.
const mockNow = new Date("2026-11-19T13:00:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

let queryClient: QueryClient;
let stats: ReturnType<typeof streakStatsClient>;

function serve(options: StreakStatsOptions | "fails", isHeld = false) {
  stats = streakStatsClient(options, { isHeld });
}

function Wrapper({ children }: PropsWithChildren) {
  return (
    <KeyLowProvider client={stats.client} queryClient={queryClient}>
      {children}
    </KeyLowProvider>
  );
}

describe("useStreakView", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    jest.mocked(useReadsEnabled).mockReturnValue(true);
    serve({});
  });

  afterEach(() => {
    queryClient.clear();
    jest.resetAllMocks();
  });

  it("should have nothing until the stats are read", async () => {
    serve({}, true);
    const { result } = await renderHook(() => useStreakView(), { wrapper: Wrapper });

    expect(result.current).toBeUndefined();

    stats.release();

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
  });

  it("should have nothing when the read fails", async () => {
    serve("fails");

    const { result } = await renderHook(() => useStreakView(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(stats.requests.count).toBeGreaterThan(0);
    });
    expect(result.current).toBeUndefined();
  });

  it("should read nothing while the terms gate is up", async () => {
    jest.mocked(useReadsEnabled).mockReturnValue(false);

    await renderHook(() => useStreakView(), { wrapper: Wrapper });

    expect(stats.requests.count).toBe(0);
  });

  it("should say the streak is at risk until today is complete", async () => {
    serve({ completeDays: ["2026-11-16", "2026-11-17", "2026-11-18"] });

    const { result } = await renderHook(() => useStreakView(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    expect(result.current?.chipState).toBe("at_risk");
    expect(result.current?.daily.current).toBe(3);
    expect(result.current?.today).toBe("2026-11-19");
  });

  it("should keep asking to complete today when yesterday was frozen and today is not complete", async () => {
    serve({ completeDays: ["2026-11-15", "2026-11-16", "2026-11-17"], earnedFreezes: 1 });

    const { result } = await renderHook(() => useStreakView(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    expect(result.current?.chipState).toBe("at_risk");
    expect(result.current?.calendar).toContainEqual({ localDate: "2026-11-18", state: "frozen" });
  });

  it("should say a freeze was used once today is complete", async () => {
    serve({
      completeDays: ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-19"],
      earnedFreezes: 1,
    });

    const { result } = await renderHook(() => useStreakView(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    expect(result.current?.chipState).toBe("freeze_used");
  });

  it("should say there is no streak when nothing is complete", async () => {
    const { result } = await renderHook(() => useStreakView(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    expect(result.current?.chipState).toBe("none");
  });

  it("should give the weekly streaks with this week at risk", async () => {
    serve({
      weighInDates: ["2026-11-03", "2026-11-10"],
      trainingWeeks: [
        { weekStart: "2026-11-09", sessions: 4 },
        { weekStart: "2026-11-16", sessions: 2 },
      ],
    });

    const { result } = await renderHook(() => useStreakView(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    expect(result.current?.training.streak).toMatchObject({ current: 1, thisWeek: "at_risk" });
    expect(result.current?.training.recent).toMatchObject({ achieved: 2, required: 4 });
    expect(result.current?.weighIn.streak).toMatchObject({ current: 2, thisWeek: "at_risk" });
  });
});
