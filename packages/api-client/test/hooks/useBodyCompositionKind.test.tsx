import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useBodyCompositionKind } from "../../src/hooks/useBodyCompositionKind";
import { bodyMeasurementRow, installBodyMeasurementsFake } from "../support/bodyMeasurements";
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

const TODAY = "2026-10-23";
const day = (index: number) => `2026-10-${String(1 + index).padStart(2, "0")}`;

/** `count` body fat readings, one a day from 1 October, falling by a tenth a day from 24 per cent. */
const bodyFatRows = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    bodyMeasurementRow({
      kind: "body_fat_pct",
      local_date: day(index),
      measured_at: `${day(index)}T07:00:00+00:00`,
      value: 24 - index / 10,
    }),
  );

const options = { range: 30, today: TODAY } as const;

describe("useBodyCompositionKind", () => {
  it("should be loading until the list has been read", async () => {
    installBodyMeasurementsFake(server, bodyFatRows(10));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyCompositionKind("body_fat_pct", options), {
      wrapper,
    });

    expect(result.current.status).toBe("loading");
    await waitFor(() => {
      expect(result.current.status).toBe("readings");
    });
  });

  it("should give a settled kind its card over the range", async () => {
    installBodyMeasurementsFake(server, bodyFatRows(20));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyCompositionKind("body_fat_pct", options), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.status).toBe("readings");
    });
    expect(result.current).toMatchObject({
      status: "readings",
      card: { kind: "body_fat_pct", state: "chart", range: 30 },
    });
  });

  it("should give a kind with fewer than 7 readings a settling card", async () => {
    installBodyMeasurementsFake(server, bodyFatRows(3));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyCompositionKind("body_fat_pct", options), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.status).toBe("readings");
    });
    expect(result.current).toMatchObject({
      card: { state: "settling", readingCount: 3 },
    });
  });

  it("should be empty when the list was read and holds nothing of this kind", async () => {
    installBodyMeasurementsFake(server, bodyFatRows(10));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyCompositionKind("lean_mass_kg", options), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.status).toBe("empty");
    });
  });

  it("should be an error when the read failed with nothing to show, and read again on refetch", async () => {
    const fake = installBodyMeasurementsFake(server, bodyFatRows(10));
    fake.failWith("XX000");
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBodyCompositionKind("body_fat_pct", options), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    fake.failWith(null);
    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("readings");
    });
  });

  it("should make no request while it is not enabled", () => {
    const fake = installBodyMeasurementsFake(server, bodyFatRows(10));
    const { wrapper } = createWrapper();

    renderHook(() => useBodyCompositionKind("body_fat_pct", { ...options, enabled: false }), {
      wrapper,
    });

    expect(fake.requests).toHaveLength(0);
  });
});
