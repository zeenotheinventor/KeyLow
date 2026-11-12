import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useSessionBarView } from "../../src/hooks/useSessionBarView";
import { acceptedRow, installAcceptedSuggestionsFake } from "../support/acceptedSuggestions";
import { routineDetailRow } from "../support/routines";
import {
  ROUTINE_DAY_ID,
  installTrainingFake,
  openSessionRow,
  routineRow,
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

// The session is on Sunday 18 October 2026, in the week that starts on Monday 12 October. The routine day
// plans 3 sets, and the accepted suggestion adds 3 more.
const SUNDAY = "2026-10-18";

/** The routine as both of its reads need it: the active routine read wants the muscles, the single read the rep range. */
const routineOfThreeSets = () => {
  const [day] = routineRow().routine_days;
  const [planned] = day?.routine_exercises ?? [];
  return routineDetailRow({
    routine_days: [
      {
        id: ROUTINE_DAY_ID,
        position: 0,
        weekday: 0,
        name: day?.name,
        routine_exercises: [{ ...planned, rep_min: 8, rep_max: 12 }],
      },
    ],
  });
};

describe("useSessionBarView", () => {
  it("should give nothing when no session is open, and read no routine and no accepted suggestions", async () => {
    const fake = installTrainingFake(server, { sessions: [] });
    const accepted = installAcceptedSuggestionsFake(server);
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useSessionBarView(), { wrapper });

    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
    expect(fake.requestsTo("workout_sessions")).toHaveLength(1);
    expect(result.current).toBeNull();
    expect(fake.requestsTo("routines")).toHaveLength(0);
    expect(accepted.reads).toHaveLength(0);
  });

  it("should make no request while enabled is false", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSessionBarView({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBeNull();
    expect(fake.requests).toEqual([]);
  });

  it("should read the accepted suggestions of the week the session's date is in", async () => {
    installTrainingFake(server, {
      sessions: [openSessionRow({ local_date: SUNDAY })],
      routine: routineOfThreeSets(),
    });
    const accepted = installAcceptedSuggestionsFake(server);
    const { wrapper } = createWrapper();

    renderHook(() => useSessionBarView(), { wrapper });

    await waitFor(() => {
      expect(accepted.reads).toHaveLength(1);
    });
    expect(accepted.reads[0]?.searchParams.getAll("local_date")).toEqual([
      "gte.2026-10-12",
      "lte.2026-10-18",
    ]);
  });

  it("should read the week of a session that started in a later one", async () => {
    installTrainingFake(server, {
      sessions: [openSessionRow({ local_date: "2026-10-21" })],
      routine: routineOfThreeSets(),
    });
    const accepted = installAcceptedSuggestionsFake(server);
    const { wrapper } = createWrapper();

    renderHook(() => useSessionBarView(), { wrapper });

    await waitFor(() => {
      expect(accepted.reads).toHaveLength(1);
    });
    expect(accepted.reads[0]?.searchParams.getAll("local_date")).toEqual([
      "gte.2026-10-19",
      "lte.2026-10-25",
    ]);
  });

  it("should show no total until the accepted suggestions are read, and never 3 and then 6", async () => {
    const fake = installTrainingFake(server, {
      sessions: [openSessionRow({ local_date: SUNDAY })],
      routine: routineOfThreeSets(),
    });
    const accepted = installAcceptedSuggestionsFake(server, {
      rows: [acceptedRow({ local_date: SUNDAY, routine_day_id: ROUTINE_DAY_ID })],
    });
    const release = accepted.hold();
    const { wrapper } = createWrapper();
    const totals: (number | undefined)[] = [];

    const { result } = renderHook(
      () => {
        const view = useSessionBarView();
        totals.push(view?.setsPlanned);
        return view;
      },
      { wrapper },
    );

    await waitFor(() => {
      expect(fake.requestsTo("routines")).toHaveLength(2);
      expect(accepted.reads).toHaveLength(1);
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(result.current).toMatchObject({ setsPlanned: 0 });

    act(() => {
      release();
    });
    await waitFor(() => {
      expect(result.current).toMatchObject({ setsPlanned: 6 });
    });
    expect(totals).not.toContain(3);
  });
});
