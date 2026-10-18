import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useDashboardBodyMap } from "../../src/hooks/useDashboardBodyMap";
import { goldenWeekData } from "../support/goldenWeekRows";
import { installTrainingFake, routineRow } from "../support/training";
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

// Thursday 15 October, 17:55 in London: the moment of the approved dashboard card.
const CARD_MOMENT = "2026-10-15T17:55:00+01:00";

describe("useDashboardBodyMap", () => {
  it("should name the warmest three muscles with their heat, as the dashboard card does", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: CARD_MOMENT }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.warmest).toStrictEqual([
      { muscle: "lats", percent: 25 },
      { muscle: "traps_mid", percent: 18 },
      { muscle: "biceps", percent: 15 },
    ]);
  });

  it("should give the Actual heat steps of the body now", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: CARD_MOMENT }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.values).toMatchObject({
      lats: 2,
      traps_mid: 1,
      biceps: 1,
      neck: 0,
    });
  });

  it("should give nothing warm and every muscle at rest when nothing is logged", async () => {
    installTrainingFake(server, { sets: [], sessions: [], routine: routineRow() });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: CARD_MOMENT }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.warmest).toStrictEqual([]);
    expect(Object.values(result.current.data?.values ?? {})).toStrictEqual(
      Array.from({ length: 22 }, () => 0),
    );
  });

  it("should name today's planned day, the Legs in progress on the golden Thursday", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: CARD_MOMENT }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.today).toStrictEqual({
      kind: "in_progress",
      dayName: "Legs",
      setsPlanned: 16,
    });
  });

  it("should name the planned day when nothing has started", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: "2026-10-17T10:00:00+01:00" }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.today).toStrictEqual({
      kind: "planned",
      dayName: "Push",
      setCount: 16,
    });
  });

  it("should say rest on a day with nothing planned", async () => {
    installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: "2026-10-16T10:00:00+01:00" }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.today).toStrictEqual({ kind: "rest", dayName: null });
  });

  it("should say rest, not today's planned day, when the routine was made active after now", async () => {
    // The device clock is behind the server's: the routine was activated on Friday by the server's clock
    // and now is still Thursday, the day of the Legs, which this routine never planned.
    installTrainingFake(server, {
      ...goldenWeekData,
      sets: [],
      sessions: [],
      routine: { ...goldenWeekData.routine, activated_at: "2026-10-16T09:00:00+00:00" },
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: CARD_MOMENT }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.today).toStrictEqual({ kind: "rest", dayName: null });
  });

  it("should say none with no active routine", async () => {
    installTrainingFake(server, { sets: [], sessions: [], routine: null });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: CARD_MOMENT }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.today).toStrictEqual({ kind: "none", dayName: null });
  });

  it("should give an error result, not throw, when two routine days share a weekday", async () => {
    const [day] = routineRow().routine_days;
    installTrainingFake(server, {
      sets: [],
      sessions: [],
      routine: routineRow({
        routine_days: [day, { ...day, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", position: 1 }],
      }),
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: CARD_MOMENT }), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(RangeError);
  });

  it("should make no request at all while enabled is false", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useDashboardBodyMap({ now: CARD_MOMENT, enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.requests).toEqual([]);
    expect(result.current).toMatchObject({ data: undefined, isPending: true });
  });

  it("should read again only the reads that failed", async () => {
    const fake = installTrainingFake(server, goldenWeekData);
    fake.failWith("42501", "routines");
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDashboardBodyMap({ now: CARD_MOMENT }), { wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    const zoneReads = fake.requestsTo("profiles").length;
    const routineReads = fake.requestsTo("routines").length;
    fake.failWith(null);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(fake.requestsTo("routines").length).toBeGreaterThan(routineReads);
    expect(fake.requestsTo("profiles")).toHaveLength(zoneReads);
  });
});
