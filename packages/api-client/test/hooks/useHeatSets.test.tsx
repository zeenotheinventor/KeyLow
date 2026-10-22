import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useHeatSets } from "../../src/hooks/useHeatSets";
import { useMuscleState } from "../../src/hooks/useMuscleState";
import { keys } from "../../src/queryKeys";
import {
  RECOGNISABLE_EXERCISE_NAME,
  RECOGNISABLE_WEIGHT,
  installTrainingFake,
  routineRow,
  setRow,
  snapshotOf,
} from "../support/training";
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

// 13:00 on 17 October in London (BST), so the heat window starts on the local day 15 days earlier.
const NOW = "2026-10-17T12:00:00Z";
const START_DAY = "2026-10-02";
const SET_PERFORMED_AT = "2026-10-16T18:00:00+00:00";

describe("useHeatSets", () => {
  it("should give the raw sets of the heat window, with their snapshots", async () => {
    installTrainingFake(server, {
      sets: [setRow({ performed_at: SET_PERFORMED_AT })],
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHeatSets(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toEqual([
      expect.objectContaining({ performed_at: SET_PERFORMED_AT, snapshot: snapshotOf() }),
    ]);
  });

  it("should hold the rows under the key the muscle state reads, so one request serves both", async () => {
    const fake = installTrainingFake(server, {
      sets: [setRow({ performed_at: SET_PERFORMED_AT })],
      routine: routineRow(),
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => ({ sets: useHeatSets(NOW), state: useMuscleState(NOW) }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.sets.data).toBeDefined();
      expect(result.current.state.data).toBeDefined();
    });
    expect(queryClient.getQueryData(keys.training.sets(START_DAY))).toHaveLength(1);
    expect(fake.requestsTo("workout_sets")).toHaveLength(1);
  });

  it("should stay pending and make no request while disabled", () => {
    const fake = installTrainingFake(server, { sets: [setRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHeatSets(NOW, { enabled: false }), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
    expect(fake.requests).toEqual([]);
  });

  it("should keep the failure free of a value from the database", async () => {
    const fake = installTrainingFake(server, { sets: [setRow()] });
    fake.failWith("42501", "workout_sets");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHeatSets(NOW), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    const reported = JSON.stringify(result.current.error?.message);
    expect(reported).not.toContain(RECOGNISABLE_EXERCISE_NAME);
    expect(reported).not.toContain(String(RECOGNISABLE_WEIGHT));
  });
});
