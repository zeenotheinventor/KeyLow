import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useExpenditureChart } from "../../src/hooks/useExpenditureChart";
import { installProgramFake, snapshotRow, startSnapshotRow } from "../support/program";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  onlineManager.setOnline(true);
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const NOW = new Date("2026-10-30T12:00:00Z");

function renderChart(enabled = true) {
  const { wrapper } = createWrapper();
  return renderHook(() => useExpenditureChart({ enabled, now: NOW }), { wrapper });
}

describe("useExpenditureChart", () => {
  it("should be pending while the history is being read", async () => {
    installProgramFake(server);

    const { result } = renderChart();

    expect(result.current).toEqual({ status: "pending" });
    // Let the read finish, so it does not land in the next test.
    await waitFor(() => {
      expect(result.current.status).toBe("empty");
    });
  });

  it("should read nothing, and stay pending, while reads are not enabled", async () => {
    const { requests } = installProgramFake(server);

    const { result } = renderChart(false);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(result.current).toEqual({ status: "pending" });
    expect(requests).toEqual([]);
  });

  it("should be empty when no week has an estimate", async () => {
    installProgramFake(server);

    const { result } = renderChart();

    await waitFor(() => {
      expect(result.current).toEqual({ status: "empty" });
    });
  });

  it("should give the chart of the weeks that have an estimate", async () => {
    installProgramFake(server, { snapshots: [startSnapshotRow(), snapshotRow()] });

    const { result } = renderChart();

    await waitFor(() => {
      expect(result.current.status).toBe("chart");
    });
    if (result.current.status !== "chart") {
      throw new Error("The chart state was expected");
    }
    expect(result.current.view.points.at(-1)).toEqual({ week: "2026-10-26", value: 2400 });
  });

  it("should be the error state when the history cannot be read, and read again on retry", async () => {
    const { failWith, recover } = installProgramFake(server, { snapshots: [snapshotRow()] });
    failWith("expenditure_snapshots", "XX000");

    const { result } = renderChart();

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    recover("expenditure_snapshots");
    if (result.current.status !== "error") {
      throw new Error("The error state was expected");
    }
    const { retry } = result.current;
    act(() => {
      retry();
    });
    await waitFor(() => {
      expect(result.current.status).toBe("chart");
    });
  });
});
