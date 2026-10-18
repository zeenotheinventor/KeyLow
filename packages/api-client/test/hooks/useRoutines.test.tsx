import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRoutines } from "../../src/hooks/useRoutines";
import { keys } from "../../src/queryKeys";
import { ROUTINE_ID, installRoutinesFake, routineListRow } from "../support/routines";
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

describe("useRoutines", () => {
  it("should give each routine with its summary worked out from its days", async () => {
    installRoutinesFake(server, { routines: [routineListRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutines({ archived: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.[0]).toMatchObject({
      id: ROUTINE_ID,
      summary: {
        dayCount: 2,
        setsPerWeek: 12,
        days: [
          { weekday: 0, exerciseCount: 2, setCount: 7 },
          { weekday: null, exerciseCount: 1, setCount: 5 },
        ],
      },
    });
  });

  it("should keep rows under the key and no summary, so the cache holds what the database held", async () => {
    installRoutinesFake(server, { routines: [routineListRow({ is_active: true })] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutines({ archived: true }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const stored = queryClient.getQueryData(keys.training.routines(true));
    expect(stored).toEqual([expect.objectContaining({ id: ROUTINE_ID, is_active: true })]);
    expect(JSON.stringify(stored)).not.toContain("setsPerWeek");
  });

  it("should read the live routines and the archived ones under different keys", async () => {
    const fake = installRoutinesFake(server, { routines: [] });
    const { queryClient, wrapper } = createWrapper();

    const live = renderHook(() => useRoutines({ archived: false }), { wrapper });
    const all = renderHook(() => useRoutines({ archived: true }), { wrapper });

    await waitFor(() => {
      expect(live.result.current.isSuccess).toBe(true);
      expect(all.result.current.isSuccess).toBe(true);
    });
    expect(fake.reads).toHaveLength(2);
    expect(queryClient.getQueryData(keys.training.routines(false))).toEqual([]);
    expect(queryClient.getQueryData(keys.training.routines(true))).toEqual([]);
  });

  it("should make no request while it is disabled", () => {
    const fake = installRoutinesFake(server, { routines: [routineListRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutines({ archived: false, enabled: false }), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.requestCount).toBe(0);
  });

  it("should report an error that names the action and the code only", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("42501");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutines({ archived: false }), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your routines (42501)");
  });
});
