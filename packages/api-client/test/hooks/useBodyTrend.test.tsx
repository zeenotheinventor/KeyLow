import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useBodyTrend } from "../../src/hooks/useBodyTrend";
import { keys } from "../../src/queryKeys";
import { bodyMeasurementRow, installBodyMeasurementsFake } from "../support/bodyMeasurements";
import { createWrapper } from "../support/wrapper";

import type { BodyMeasurementTestRow } from "../support/bodyMeasurements";

// The real function behind a spy, so a test can count how often the trend is worked out.
vi.mock("@keylow/core/weight", async (importOriginal) => {
  const original = await importOriginal<typeof import("@keylow/core/weight")>();
  return { ...original, computeBodyTrend: vi.fn(original.computeBodyTrend) };
});

const { computeBodyTrend, isBodyTrendSettling } = await import("@keylow/core/weight");

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  vi.mocked(computeBodyTrend).mockClear();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const day = (index: number) => `2026-10-${String(1 + index).padStart(2, "0")}`;

/** `count` body fat readings, one a day from 1 October, falling slowly from 24 per cent. */
const bodyFatRows = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    bodyMeasurementRow({
      kind: "body_fat_pct",
      local_date: day(index),
      measured_at: `${day(index)}T07:00:00+00:00`,
      value: 24 - index / 10,
    }),
  );

const readingsOf = (rows: BodyMeasurementTestRow[]) =>
  rows.map((row) => ({ localDate: row.local_date, value: row.value }));

describe("useBodyTrend", () => {
  it("should give the same points as computeBodyTrend over the same rows", async () => {
    const rows = bodyFatRows(10);
    installBodyMeasurementsFake(server, rows);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyTrend("body_fat_pct"), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    const expected = computeBodyTrend(readingsOf(rows), "body_fat_pct");
    expect(expected).toHaveLength(10);
    expect(result.current.points).toEqual(expected);
    expect(result.current.settling).toBe(isBodyTrendSettling(expected));
  });

  it("should expose each day's point by date", async () => {
    installBodyMeasurementsFake(server, bodyFatRows(10));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyTrend("body_fat_pct"), { wrapper });

    await waitFor(() => {
      expect(result.current.byDate.size).toBe(10);
    });
    expect(result.current.byDate.get("2026-10-10")).toMatchObject({
      raw: 23.1,
      interpolated: false,
    });
    expect(result.current.byDate.get("2030-01-01")).toBeUndefined();
  });

  it("should work out the trend of the asked kind from that kind's rows only", async () => {
    const fat = bodyFatRows(8);
    const lean = Array.from({ length: 3 }, (_, index) =>
      bodyMeasurementRow({
        kind: "lean_mass_kg",
        local_date: day(index),
        measured_at: `${day(index)}T07:00:00+00:00`,
        value: 60 + index,
      }),
    );
    installBodyMeasurementsFake(server, [...fat, ...lean]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyTrend("lean_mass_kg"), { wrapper });

    await waitFor(() => {
      expect(result.current.points).toHaveLength(3);
    });
    expect(result.current.points).toEqual(computeBodyTrend(readingsOf(lean), "lean_mass_kg"));
  });

  it("should be settling under seven readings and settled from seven", async () => {
    installBodyMeasurementsFake(server, bodyFatRows(6));
    const six = createWrapper();
    const sixRendered = renderHook(() => useBodyTrend("body_fat_pct"), { wrapper: six.wrapper });
    await waitFor(() => {
      expect(sixRendered.result.current.points).toHaveLength(6);
    });
    expect(sixRendered.result.current.settling).toBe(true);

    server.resetHandlers();
    installBodyMeasurementsFake(server, bodyFatRows(7));
    const seven = createWrapper();
    const sevenRendered = renderHook(() => useBodyTrend("body_fat_pct"), {
      wrapper: seven.wrapper,
    });
    await waitFor(() => {
      expect(sevenRendered.result.current.points).toHaveLength(7);
    });
    expect(sevenRendered.result.current.settling).toBe(false);
  });

  it("should be loading, with no points, before the list arrives", () => {
    installBodyMeasurementsFake(server, bodyFatRows(10));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyTrend("body_fat_pct"), { wrapper });

    expect(result.current).toMatchObject({
      points: [],
      settling: false,
      isLoading: true,
      isError: false,
    });
    expect(result.current.byDate.size).toBe(0);
  });

  it("should report an error when the list cannot be read", async () => {
    const fake = installBodyMeasurementsFake(server, bodyFatRows(10));
    fake.failWith("XX000");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyTrend("body_fat_pct"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.points).toEqual([]);
  });

  it("should not work the trend out again on a re-render that brings no new data", async () => {
    installBodyMeasurementsFake(server, bodyFatRows(10));
    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(() => useBodyTrend("body_fat_pct"), { wrapper });
    await waitFor(() => {
      expect(result.current.points).toHaveLength(10);
    });
    const before = result.current;
    const callsBefore = vi.mocked(computeBodyTrend).mock.calls.length;

    rerender();

    expect(vi.mocked(computeBodyTrend).mock.calls).toHaveLength(callsBefore);
    expect(result.current.points).toBe(before.points);
    expect(result.current.byDate).toBe(before.byDate);
  });

  it("should work the trend out again when an invalidation of the family brings a changed list", async () => {
    const fake = installBodyMeasurementsFake(server, bodyFatRows(10));
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useBodyTrend("body_fat_pct"), { wrapper });
    await waitFor(() => {
      expect(result.current.points).toHaveLength(10);
    });
    const callsBefore = vi.mocked(computeBodyTrend).mock.calls.length;

    fake.rows.push({
      ...bodyMeasurementRow({ local_date: day(10), measured_at: `${day(10)}T07:00:00+00:00` }),
      deleted_at: null,
    });
    await act(() => queryClient.invalidateQueries({ queryKey: keys.bodyMeasurements.all }));

    await waitFor(() => {
      expect(result.current.points).toHaveLength(11);
    });
    expect(vi.mocked(computeBodyTrend).mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it("should make no request while enabled is false", async () => {
    const fake = installBodyMeasurementsFake(server, bodyFatRows(10));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyTrend("body_fat_pct", { enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
    expect(result.current.points).toEqual([]);
  });
});
