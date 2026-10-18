import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useMuscleList } from "../../src/hooks/useMuscleList";
import { GOLDEN_WEEK_START, goldenWeekData } from "../support/goldenWeekRows";
import { installTrainingFake } from "../support/training";
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

const THURSDAY_EVENING = "2026-10-15T19:00:00+01:00";

describe("useMuscleList", () => {
  it("should give the seven groups in the order of the muscle list", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMuscleList({ view: "actual", weekStart: GOLDEN_WEEK_START, now: THURSDAY_EVENING }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.map(({ group }) => group)).toStrictEqual([
      "chest",
      "shoulders",
      "back",
      "arms",
      "core",
      "legs",
      "neck",
    ]);
    expect(result.current.data?.flatMap(({ rows }) => rows)).toHaveLength(22);
  });

  it("should draw the rows of the muscle list board at Thursday 15 October 19:00 Actual", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMuscleList({ view: "actual", weekStart: GOLDEN_WEEK_START, now: THURSDAY_EVENING }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const rows = result.current.data?.flatMap((group) => group.rows) ?? [];
    const board = (muscle: string) => rows.find((row) => row.muscle === muscle);
    // Heat percent, step and ready in hours, as the canvas board writes them.
    expect(board("lats")).toStrictEqual({
      muscle: "lats",
      heatPercent: 24,
      heatStep: 2,
      readyInHours: 0,
    });
    expect(board("glute_max")).toStrictEqual({
      muscle: "glute_max",
      heatPercent: 40,
      heatStep: 3,
      readyInHours: 19,
    });
    expect(board("quads")).toStrictEqual({
      muscle: "quads",
      heatPercent: 50,
      heatStep: 3,
      readyInHours: 27,
    });
    expect(board("hamstrings")).toStrictEqual({
      muscle: "hamstrings",
      heatPercent: 55,
      heatStep: 3,
      readyInHours: 31,
    });
    expect(board("neck")).toStrictEqual({
      muscle: "neck",
      heatPercent: 0,
      heatStep: 0,
      readyInHours: 0,
    });
  });

  it("should read the list at the instant of the scrubber day picked", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useMuscleList({
          view: "actual",
          at: "2026-10-13",
          weekStart: GOLDEN_WEEK_START,
          now: THURSDAY_EVENING,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const lats = result.current.data
      ?.flatMap((group) => group.rows)
      .find((row) => row.muscle === "lats");
    // Tuesday 20:00, Actual: lats at step 5, as the scrubber board draws it.
    expect(lats?.heatStep).toBe(5);
  });

  it("should make no request at all while enabled is false", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useMuscleList({
          view: "projected",
          weekStart: GOLDEN_WEEK_START,
          now: THURSDAY_EVENING,
          enabled: false,
        }),
      { wrapper },
    );

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
    expect(result.current).toMatchObject({ data: undefined, isPending: true });
  });
});
