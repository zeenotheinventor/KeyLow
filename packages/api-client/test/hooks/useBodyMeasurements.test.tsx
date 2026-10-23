import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useBodyMeasurements } from "../../src/hooks/useBodyMeasurements";
import { keys } from "../../src/queryKeys";
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

describe("useBodyMeasurements", () => {
  it("should load the live readings of one kind newest first and cache them under that kind's list key", async () => {
    const older = bodyMeasurementRow({
      local_date: "2026-10-14",
      measured_at: "2026-10-14T07:00:00+00:00",
    });
    const newer = bodyMeasurementRow({
      local_date: "2026-10-15",
      measured_at: "2026-10-15T07:00:00+00:00",
    });
    const otherKind = bodyMeasurementRow({ kind: "lean_mass_kg", value: 60 });
    installBodyMeasurementsFake(server, [older, newer, otherKind]);
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyMeasurements("body_fat_pct"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([newer, older]);
    expect(queryClient.getQueryData(keys.bodyMeasurements.list("body_fat_pct"))).toEqual([
      newer,
      older,
    ]);
    expect(queryClient.getQueryData(keys.bodyMeasurements.list("lean_mass_kg"))).toBeUndefined();
  });

  it("should load every row past the 1,000 a page holds", async () => {
    installBodyMeasurementsFake(
      server,
      Array.from({ length: 1100 }, () => bodyMeasurementRow({ kind: "lean_mass_kg", value: 60 })),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyMeasurements("lean_mass_kg"), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toHaveLength(1100);
  });

  it("should make no request while enabled is false", async () => {
    const fake = installBodyMeasurementsFake(server, [bodyMeasurementRow()]);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useBodyMeasurements("body_fat_pct", { enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.requests).toEqual([]);
  });

  it("should read the other kind afresh when the kind changes", async () => {
    const fat = bodyMeasurementRow({ kind: "body_fat_pct", value: 22 });
    const lean = bodyMeasurementRow({ kind: "lean_mass_kg", value: 60 });
    installBodyMeasurementsFake(server, [fat, lean]);
    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(({ kind }) => useBodyMeasurements(kind), {
      wrapper,
      initialProps: { kind: "body_fat_pct" as "body_fat_pct" | "lean_mass_kg" },
    });
    await waitFor(() => {
      expect(result.current.data).toEqual([fat]);
    });

    rerender({ kind: "lean_mass_kg" });

    await waitFor(() => {
      expect(result.current.data).toEqual([lean]);
    });
  });
});
