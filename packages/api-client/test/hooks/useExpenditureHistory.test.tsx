import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useExpenditureHistory } from "../../src/hooks/useExpenditureHistory";
import { keys } from "../../src/queryKeys";
import {
  CHECKIN_SNAPSHOT_ID,
  START_SNAPSHOT_ID,
  eligibleMeasurement,
  installProgramFake,
  snapshotRow,
  startSnapshotRow,
} from "../support/program";
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

// 12:00 on Saturday 24 October in London, so today is the 24th.
const NOW = "2026-10-24T12:00:00Z";

describe("useExpenditureHistory", () => {
  it("should load the snapshots of the last weeks, oldest first, and cache them under the key of the range", async () => {
    installProgramFake(server, {
      snapshots: [
        snapshotRow({ id: CHECKIN_SNAPSHOT_ID, as_of_date: "2026-10-23" }),
        startSnapshotRow({ id: START_SNAPSHOT_ID, as_of_date: "2026-10-09" }),
      ],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useExpenditureHistory({ weeks: 4, now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toEqual([
      {
        id: START_SNAPSHOT_ID,
        kind: "start",
        asOfDate: "2026-10-09",
        muKcal: 2200,
        varKcal2: 90000,
        measurement: null,
      },
      {
        id: CHECKIN_SNAPSHOT_ID,
        kind: "checkin",
        asOfDate: "2026-10-23",
        muKcal: 2400,
        varKcal2: 10000,
        measurement: eligibleMeasurement,
      },
    ]);
    expect(queryClient.getQueryData(keys.program.expenditureHistory(4))).toEqual(
      result.current.data,
    );
  });

  it("should read from four weeks before today, in the profile zone", async () => {
    // 23:30 UTC on Saturday 24 Oct is 12:30 on Sunday 25 Oct in Auckland.
    const { requestsTo } = installProgramFake(server, { timeZone: "Pacific/Auckland" });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useExpenditureHistory({ weeks: 4, now: "2026-10-24T23:30:00Z" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(requestsTo("expenditure_snapshots")[0]?.url.searchParams.get("as_of_date")).toBe(
      "gte.2026-09-27",
    );
  });

  it("should read in UTC for a profile with no time zone", async () => {
    const { requestsTo } = installProgramFake(server, { timeZone: null });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useExpenditureHistory({ weeks: 4, now: "2026-10-24T23:30:00Z" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(requestsTo("expenditure_snapshots")[0]?.url.searchParams.get("as_of_date")).toBe(
      "gte.2026-09-26",
    );
  });

  it("should keep two ranges apart, each in its own cache entry with its own request", async () => {
    const { requestsTo } = installProgramFake(server, {
      snapshots: [snapshotRow({ as_of_date: "2026-10-23" })],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(
      () => ({
        short: useExpenditureHistory({ weeks: 4, now: NOW }),
        long: useExpenditureHistory({ weeks: 26, now: NOW }),
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.short.data).toBeDefined();
      expect(result.current.long.data).toBeDefined();
    });
    expect(
      requestsTo("expenditure_snapshots").map((request) =>
        request.url.searchParams.get("as_of_date"),
      ),
    ).toEqual(expect.arrayContaining(["gte.2026-09-26", "gte.2026-04-25"]));
    expect(queryClient.getQueryData(keys.program.expenditureHistory(4))).toBeDefined();
    expect(queryClient.getQueryData(keys.program.expenditureHistory(26))).toBeDefined();
  });

  it("should make no request at all while enabled is false", async () => {
    const { requests } = installProgramFake(server, { snapshots: [snapshotRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useExpenditureHistory({ weeks: 4, now: NOW, enabled: false }),
      { wrapper },
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("should expose the error, with the code only, when the read fails", async () => {
    const { failWith } = installProgramFake(server);
    failWith("expenditure_snapshots", "XX000");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExpenditureHistory({ weeks: 4, now: NOW }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty(
      "message",
      "Could not load your expenditure history (XX000)",
    );
  });
});
