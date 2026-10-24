import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useProgramSummary } from "../../src/hooks/useProgramSummary";
import { keys } from "../../src/queryKeys";
import {
  PROGRAM_ID,
  installProgramFake,
  programRow,
  snapshotRow,
  startSnapshotRow,
  targetsRow,
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

describe("useProgramSummary", () => {
  it("should load the mapped summary and cache it under the program summary key", async () => {
    installProgramFake(server, {
      programs: [programRow()],
      snapshots: [snapshotRow({ as_of_date: "2026-10-30" }), startSnapshotRow()],
      targets: [
        targetsRow({ effective_from: "2026-10-30", calories_kcal: 2140 }),
        targetsRow({
          effective_from: "2026-10-23",
          effective_to: "2026-10-30",
          calories_kcal: 2150,
        }),
      ],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useProgramSummary(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toMatchObject({
      program: { id: PROGRAM_ID, startedOn: "2026-10-23", nextCheckinDate: "2026-11-06" },
      latestSnapshot: { kind: "checkin", asOfDate: "2026-10-30" },
      previousSnapshot: { kind: "start", asOfDate: "2026-10-23" },
      currentTargets: { effectiveFrom: "2026-10-30", caloriesKcal: 2140, isCurrent: true },
      previousTargets: { effectiveFrom: "2026-10-23", caloriesKcal: 2150, isCurrent: false },
    });
    expect(queryClient.getQueryData(keys.program.summary)).toEqual(result.current.data);
  });

  it("should load a null program when there is none", async () => {
    installProgramFake(server);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProgramSummary(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.program).toBeNull();
  });

  it("should make no request while enabled is false", async () => {
    const { requests } = installProgramFake(server, { programs: [programRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProgramSummary({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("should expose the error, with the code only, when a read fails", async () => {
    const { failWith } = installProgramFake(server, { programs: [programRow()] });
    failWith("targets", "XX000");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProgramSummary(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty("message", "Could not load your program (XX000)");
    expect(result.current.data).toBeUndefined();
  });
});
