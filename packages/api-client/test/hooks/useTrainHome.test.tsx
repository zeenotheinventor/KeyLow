import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useTrainHome } from "../../src/hooks/useTrainHome";
import { goldenRoutine, goldenSessions, GOLDEN_TIME_ZONE } from "../support/goldenWeekRows";
import { REST_URL, postgrestRows } from "../support/postgrest";
import { openSessionRow } from "../support/training";
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

const THURSDAY_1755 = new Date("2026-10-15T16:55:00Z");
const LEGS_ID = "00000003-0000-4000-8000-000000000003";
const ROUTINE_ID = goldenRoutine.id;
const [monday, tuesday] = goldenSessions;

/** What the database holds. The three reads of `workout_sessions` are told apart by what they filter on. */
function installBackend(data: {
  routine?: unknown;
  weekSessions?: readonly unknown[];
  activeSession?: unknown;
  anySession?: boolean;
  failRoutine?: boolean;
}) {
  const requests: string[] = [];
  server.use(
    http.get(`${REST_URL}/profiles`, ({ request }) => {
      requests.push("profiles");
      return postgrestRows(request, [{ timezone: GOLDEN_TIME_ZONE }]);
    }),
    http.get(`${REST_URL}/routines`, ({ request }) => {
      requests.push("routines");
      if (data.failRoutine === true) {
        return postgrestRows(request, [], 500);
      }
      return postgrestRows(request, data.routine === undefined ? [] : [data.routine]);
    }),
    http.get(`${REST_URL}/workout_sessions`, ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.has("local_date")) {
        requests.push("week");
        return postgrestRows(request, data.weekSessions ?? []);
      }
      if (url.searchParams.get("ended_at") === "is.null") {
        requests.push("active");
        return postgrestRows(request, data.activeSession === undefined ? [] : [data.activeSession]);
      }
      requests.push("ever");
      return postgrestRows(request, data.anySession === true ? [{ id: "x" }] : []);
    }),
  );
  return requests;
}

const settings = { now: THURSDAY_1755, enabled: true };

describe("useTrainHome", () => {
  it("should plan Thursday's Legs on Thursday at 17:55 with the routine's day to follow", async () => {
    installBackend({ routine: goldenRoutine, weekSessions: [monday, tuesday] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTrainHome(settings), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    const home = result.current;
    if (home.status !== "ready") {
      throw new Error("The home is not ready");
    }
    expect(home.today).toMatchObject({
      card: { kind: "planned", dayName: "Legs", exerciseCount: 5, setCount: 16 },
      plannedDayId: LEGS_ID,
      context: { localDate: "2026-10-15" },
    });
    expect(home.routineId).toBe(ROUTINE_ID);
    expect(home.routineDays.map((day) => day.name)).toEqual(["Push", "Pull", "Legs", "Push"]);
    expect(home.week?.weekStart).toBe("2026-10-12");
    expect(home.timeZone).toBe(GOLDEN_TIME_ZONE);
  });

  it("should offer Resume for the session in progress", async () => {
    installBackend({
      routine: goldenRoutine,
      weekSessions: [monday, tuesday],
      activeSession: openSessionRow({
        started_at: "2026-10-15T16:30:00+00:00",
        local_date: "2026-10-15",
        routine_day_id: LEGS_ID,
        routine_days: { name: "Legs" },
        workout_sets: [],
      }),
    });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTrainHome(settings), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(result.current).toMatchObject({ today: { card: { kind: "in_progress" } } });
  });

  it("should tell a first visit from no routine by whether a session was ever logged", async () => {
    installBackend({});
    const first = createWrapper();
    const firstVisit = renderHook(() => useTrainHome(settings), { wrapper: first.wrapper });
    await waitFor(() => {
      expect(firstVisit.result.current.status).toBe("ready");
    });
    expect(firstVisit.result.current).toMatchObject({
      today: null,
      hasRoutine: false,
      hasLoggedSession: false,
    });

    server.resetHandlers();
    installBackend({ anySession: true });
    const second = createWrapper();
    const noRoutine = renderHook(() => useTrainHome(settings), { wrapper: second.wrapper });
    await waitFor(() => {
      expect(noRoutine.result.current.status).toBe("ready");
    });
    expect(noRoutine.result.current).toMatchObject({ today: null, hasLoggedSession: true });
  });

  it("should be an error when a read fails with nothing to show, and read again on retry", async () => {
    installBackend({ failRoutine: true });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTrainHome(settings), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    server.resetHandlers();
    installBackend({ routine: goldenRoutine, weekSessions: [monday, tuesday] });
    if (result.current.status === "error") {
      result.current.retry();
    }
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
  });

  it("should make no request while it is not enabled", async () => {
    const requests = installBackend({ routine: goldenRoutine });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTrainHome({ now: THURSDAY_1755, enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.status).toBe("loading");
    expect(requests).toEqual([]);
  });
});
