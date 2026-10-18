import { computeTrend } from "@keylow/core/engine";
import { buildManualWeighIn, isTrendSettling, weeklyRateKg } from "@keylow/core/weight";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAddWeighIn } from "../../src/hooks/useAddWeighIn";
import { useWeightTrend } from "../../src/hooks/useWeightTrend";
import { installWeighInsFake, weighInRow } from "../support/weighIns";
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

// Ten days, one reading a day, falling slowly. Day 8 is a spike far above the rest.
const readings: [string, number][] = [
  ["2026-10-01", 82.0],
  ["2026-10-02", 81.9],
  ["2026-10-03", 81.8],
  ["2026-10-04", 81.8],
  ["2026-10-05", 81.7],
  ["2026-10-06", 81.6],
  ["2026-10-07", 81.6],
  ["2026-10-08", 95.0],
  ["2026-10-09", 81.4],
  ["2026-10-10", 81.3],
];
const rows = readings.map(([date, weight]) =>
  weighInRow({ local_date: date, measured_at: `${date}T07:00:00+00:00`, weight_kg: weight }),
);

describe("useWeightTrend", () => {
  it("should give the same points as computeTrend over the same rows", async () => {
    installWeighInsFake(server, rows);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeightTrend(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    const expected = computeTrend(
      rows.map((row) => ({ localDate: row.local_date, weightKg: row.weight_kg })),
    );
    expect(expected).toHaveLength(10);
    expect(result.current.points).toEqual(expected);
    expect(result.current.weeklyRateKg).toBe(weeklyRateKg(expected));
    expect(result.current.settling).toBe(isTrendSettling(expected));
  });

  it("should expose each day's point by date, with the spike marked as rejected", async () => {
    installWeighInsFake(server, rows);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeightTrend(), { wrapper });

    await waitFor(() => {
      expect(result.current.byDate.size).toBe(10);
    });
    expect(result.current.byDate.get("2026-10-08")).toMatchObject({ rawKg: 95, rejected: true });
    expect(result.current.byDate.get("2026-10-09")).toMatchObject({ rejected: false });
    expect(result.current.byDate.get("2030-01-01")).toBeUndefined();
  });

  it("should be loading, with no points, before the list arrives", () => {
    installWeighInsFake(server, rows);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeightTrend(), { wrapper });

    expect(result.current).toMatchObject({
      points: [],
      weeklyRateKg: null,
      settling: false,
      isLoading: true,
      isError: false,
    });
    expect(result.current.byDate.size).toBe(0);
  });

  it("should report an error when the list cannot be read", async () => {
    const fake = installWeighInsFake(server, rows);
    fake.failWith("XX000");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeightTrend(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.points).toEqual([]);
  });

  it("should keep the same points while a re-render brings no new data", async () => {
    installWeighInsFake(server, rows);
    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(() => useWeightTrend(), { wrapper });
    await waitFor(() => {
      expect(result.current.points).toHaveLength(10);
    });
    const before = result.current;

    rerender();

    expect(result.current.points).toBe(before.points);
    expect(result.current.byDate).toBe(before.byDate);
  });

  it("should make no request while enabled is false", async () => {
    const fake = installWeighInsFake(server, rows);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeightTrend({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
    expect(result.current.points).toEqual([]);
  });

  it("should recompute after a write", async () => {
    installWeighInsFake(server, rows);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => ({ trend: useWeightTrend(), add: useAddWeighIn() }), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.trend.points).toHaveLength(10);
    });

    await act(() =>
      result.current.add.mutateAsync(
        buildManualWeighIn({
          weightKg: 81.2,
          measuredAt: new Date("2026-10-11T07:00:00Z"),
          note: null,
          timeZone: "Europe/London",
        }),
      ),
    );

    await waitFor(() => {
      expect(result.current.trend.points).toHaveLength(11);
    });
    expect(result.current.trend.byDate.get("2026-10-11")).toMatchObject({ rawKg: 81.2 });
  });
});
