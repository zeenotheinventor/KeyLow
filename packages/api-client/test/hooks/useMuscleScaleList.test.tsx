import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useBodyMap } from "../../src/hooks/useBodyMap";
import { useMuscleScaleList } from "../../src/hooks/useMuscleScaleList";
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

// Sunday 18 October 2026 at 20:00 in London, the moment of `web-body · volume` and `web-body · gap`.
const SUNDAY_EVENING = "2026-10-18T20:00:00+01:00";
const moment = { weekStart: GOLDEN_WEEK_START, now: SUNDAY_EVENING };

describe("useMuscleScaleList", () => {
  it("should give the Volume card of the board in Projected: twelve rows, most sets first", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMuscleScaleList({ ...moment, scale: "volume", view: "projected" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toMatchObject({
      scale: "volume",
      moreMaintaining: 3,
      notTrained: 7,
    });
    expect(result.current.data?.rows.map((row) => row.muscle)).toStrictEqual([
      "triceps",
      "delt_front",
      "delt_side",
      "lats",
      "chest_upper",
      "chest_lower",
      "biceps",
      "traps_mid",
      "delt_rear",
      "hamstrings",
      "quads",
      "glute_max",
    ]);
  });

  it("should count the sets logged so far in Actual", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMuscleScaleList({ ...moment, scale: "volume", view: "actual" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.rows[0]).toStrictEqual({
      muscle: "lats",
      weeklySets: 11,
      status: "productive",
    });
  });

  it("should give the Gap card of the board: five behind, seven on plan, three more on plan, seven not in plan", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useMuscleScaleList({ ...moment, scale: "gap", view: "actual" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toMatchObject({ scale: "gap", moreOnPlan: 3, notInPlan: 7 });
    expect(
      result.current.data?.rows.map((row) => [
        row.muscle,
        "done" in row ? row.done : -1,
        "planned" in row ? row.planned : -1,
      ]),
    ).toStrictEqual([
      ["triceps", 7.5, 15],
      ["delt_front", 6, 12],
      ["delt_side", 5.5, 11],
      ["chest_upper", 4.8, 9.6],
      ["chest_lower", 4.5, 9],
      ["lats", 11, 11],
      ["biceps", 8.5, 8.5],
      ["traps_mid", 7.75, 7.75],
      ["delt_rear", 5.5, 5.5],
      ["hamstrings", 5.5, 5.5],
      ["quads", 5, 5],
      ["glute_max", 4, 4],
    ]);
  });

  it("should read the same rows as the figures and switch scale with no new request", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result, rerender } = renderHook(
      ({ scale }: { scale: "volume" | "gap" }) => {
        useBodyMap({ ...moment, scale, view: "actual" });
        return useMuscleScaleList({ ...moment, scale, view: "actual" });
      },
      { wrapper, initialProps: { scale: "volume" } },
    );
    await waitFor(() => {
      expect(result.current.data?.scale).toBe("volume");
    });
    const requestCount = fake.requests.length;

    rerender({ scale: "gap" });

    expect(result.current.data?.scale).toBe("gap");
    expect(result.current.isPending).toBe(false);
    expect(fake.requests).toHaveLength(requestCount);
  });

  it("should make no request at all when it is switched off", () => {
    const fake = installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    renderHook(
      () => useMuscleScaleList({ ...moment, scale: "volume", view: "actual", enabled: false }),
      { wrapper },
    );

    expect(fake.requests).toHaveLength(0);
  });

  it("should fail on a week that does not start on a Monday, without a request", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () =>
        useMuscleScaleList({
          weekStart: "2026-10-13",
          now: SUNDAY_EVENING,
          scale: "gap",
          view: "actual",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(fake.requests).toHaveLength(0);
  });
});
