import { describeExerciseTarget } from "@keylow/core/copy";
import { buildSetSnapshot } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useSessionView } from "../../src/hooks/useSessionView";
import { useUndoAcceptedSuggestion } from "../../src/hooks/useUndoAcceptedSuggestion";
import { keys } from "../../src/queryKeys";
import {
  INCLINE_DUMBBELL_PRESS_ID,
  LEGS_DAY_ID,
  THURSDAY,
  acceptedRow,
  installAcceptedSuggestionsFake,
} from "../support/acceptedSuggestions";
import { goldenWeekData } from "../support/goldenWeekRows";
import { REST_URL, postgrestRows } from "../support/postgrest";
import { installTrainingFake, openSessionRow, sessionSetRow } from "../support/training";
import { createWrapper } from "../support/wrapper";

import type { SessionView } from "../../src/hooks/sessionViewTypes";
import type { QueryClient } from "@tanstack/react-query";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

const PUSH_DAY_ID = "00000003-0000-4000-8000-000000000001";
const LEGS_SETS = 16;
const PRESS_SETS = 3;

/** The golden Thursday: Legs is open with nothing logged, and the routine is the golden one. */
function renderView({
  session = {},
  rows = [],
  holdAcceptedSuggestions = false,
  failAcceptedReads = false,
  cache,
}: {
  session?: Record<string, unknown>;
  rows?: Record<string, unknown>[];
  holdAcceptedSuggestions?: boolean;
  failAcceptedReads?: boolean;
  /** Fills the query cache before the first render, as a screen that read earlier has it. */
  cache?: (queryClient: QueryClient) => void;
} = {}) {
  installTrainingFake(server, {
    ...goldenWeekData,
    sessions: [
      openSessionRow({
        local_date: THURSDAY,
        routine_day_id: LEGS_DAY_ID,
        routine_days: { name: "Legs" },
        workout_sets: [],
        ...session,
      }),
    ],
  });
  const accepted = installAcceptedSuggestionsFake(server, { rows });
  const release = holdAcceptedSuggestions ? accepted.hold() : () => undefined;
  if (failAcceptedReads) {
    accepted.failReadsWith("XX000");
  }
  server.use(
    http.get(`${REST_URL}/profiles`, ({ request }) =>
      postgrestRows(request, [{ weight_unit: "kg" }]),
    ),
  );
  const { wrapper, queryClient } = createWrapper();
  cache?.(queryClient);
  const rendered = renderHook(
    () => ({ view: useSessionView({ enabled: true }), undo: useUndoAcceptedSuggestion() }),
    { wrapper },
  );
  return { ...rendered, accepted, queryClient, release };
}

async function ready(result: { current: { view: SessionView } }) {
  await waitFor(() => {
    expect(result.current.view.status).toBe("ready");
  });
  const { view } = result.current;
  if (view.status !== "ready") {
    throw new Error("The session view is ready");
  }
  return view;
}

describe("useSessionView with the suggestion accepted for the session's day", () => {
  it("should plan the added sets once, in the header and the rows, with the targets the suggestion carries", async () => {
    const { result } = renderView({ rows: [acceptedRow()] });

    const view = await ready(result);

    expect(view.header.setsPlanned).toBe(LEGS_SETS + PRESS_SETS);
    expect(view.progress.planned).toBe(LEGS_SETS + PRESS_SETS);
    const press = view.exercises.find(
      ({ exercise }) => exercise.exerciseId === INCLINE_DUMBBELL_PRESS_ID,
    );
    expect(press).toMatchObject({
      name: "Incline Dumbbell Press",
      plan: { sets: PRESS_SETS, repMin: 8, repMax: 10, rir: 2 },
    });
    expect(press?.target).toContain("3 × 8 to 10");
    expect(press?.exercise.rows).toHaveLength(PRESS_SETS);
    expect(press?.muscles).not.toBeNull();
    expect(view.exercises).toHaveLength(6);
    expect(view.plannedNames?.map(({ name }) => name)).toContain("Incline Dumbbell Press");
  });

  it("should leave the plan alone when nothing is accepted", async () => {
    const { result } = renderView();

    const view = await ready(result);

    expect(view.header.setsPlanned).toBe(LEGS_SETS);
    expect(view.exercises).toHaveLength(5);
  });

  it("should leave a session of another routine day alone, whichever day it was started from after the accept", async () => {
    const { result } = renderView({
      session: { routine_day_id: PUSH_DAY_ID, routine_days: { name: "Push" } },
      rows: [acceptedRow()],
    });

    const view = await ready(result);

    // Push is 16 sets of 5 exercises of its own (it holds the press already), so 19 would be Legs' sum.
    expect(view.header.setsPlanned).toBe(16);
    expect(view.exercises).toHaveLength(5);
  });

  it("should leave an older open session alone that is not of the accepted date", async () => {
    const { result } = renderView({
      session: { local_date: "2026-10-08" },
      rows: [acceptedRow()],
    });

    const view = await ready(result);

    expect(view.header.setsPlanned).toBe(LEGS_SETS);
  });

  it("should count a set already logged on the added exercise against its plan, not beyond it", async () => {
    const { result } = renderView({
      session: {
        workout_sets: [
          sessionSetRow({
            exercise_id: INCLINE_DUMBBELL_PRESS_ID,
            id: "55555555-5555-4555-8555-555555555551",
          }),
        ],
      },
      rows: [acceptedRow()],
    });

    const view = await ready(result);

    expect(view.progress.extra).toBe(0);
    expect(view.header.setsLogged).toBe(1);
    expect(view.header.setsPlanned).toBe(LEGS_SETS + PRESS_SETS);
  });

  it("should wait for the accepted suggestions, so the total never reads 16 and then 19", async () => {
    const { result, accepted, release } = renderView({
      rows: [acceptedRow()],
      holdAcceptedSuggestions: true,
    });

    await waitFor(() => {
      expect(accepted.reads.length).toBeGreaterThan(0);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(result.current.view.status).toBe("loading");

    release();
    const view = await ready(result);
    expect(view.header.setsPlanned).toBe(LEGS_SETS + PRESS_SETS);
  });

  it("should show the session without the additions when the accepted suggestions cannot be read", async () => {
    const { result } = renderView({ rows: [acceptedRow()], failAcceptedReads: true });

    const view = await ready(result);

    expect(view.header.setsPlanned).toBe(LEGS_SETS);
  });

  it("should take the additions off when the suggestion is undone while the session is open, a card with no set going", async () => {
    const row = acceptedRow();
    const { result } = renderView({ rows: [row] });
    await ready(result);

    await act(async () => {
      await result.current.undo.mutateAsync(String(row["id"]));
    });

    await waitFor(() => {
      const { view } = result.current;
      expect(view.status === "ready" && view.exercises.length).toBe(5);
    });
  });

  it("should keep an added exercise with sets logged as a card, its sets beyond the plan, once the suggestion is undone", async () => {
    const row = acceptedRow();
    const { result } = renderView({
      session: {
        workout_sets: [
          sessionSetRow({
            exercise_id: INCLINE_DUMBBELL_PRESS_ID,
            id: "55555555-5555-4555-8555-555555555551",
          }),
        ],
      },
      rows: [row],
    });
    await ready(result);

    await act(async () => {
      await result.current.undo.mutateAsync(String(row["id"]));
    });

    await waitFor(() => {
      const { view } = result.current;
      expect(view.status === "ready" && view.progress.extra).toBe(1);
    });
    const view = await ready(result);
    expect(
      view.exercises.some(({ exercise }) => exercise.exerciseId === INCLINE_DUMBBELL_PRESS_ID),
    ).toBe(true);
  });
});

describe("useSessionView while the accepted suggestions wait for a connection", () => {
  it("should show the session at once without the additions, and gain them when the connection returns", async () => {
    // A phone that read everything but the accepted suggestions before it went offline.
    const warm = renderView({ rows: [acceptedRow()] });
    await ready(warm.result);
    const saved = warm.queryClient
      .getQueryCache()
      .getAll()
      .filter(({ queryKey }) => queryKey[1] !== keys.training.acceptedSuggestionsAll[1])
      .map(({ queryKey, state }) => ({ queryKey, data: state.data }));
    warm.unmount();
    act(() => {
      onlineManager.setOnline(false);
    });

    const { result } = renderView({
      rows: [acceptedRow()],
      cache: (queryClient) => {
        for (const { queryKey, data } of saved) {
          queryClient.setQueryData(queryKey, data);
        }
      },
    });

    const offline = await ready(result);
    expect(offline.header.setsPlanned).toBe(LEGS_SETS);
    expect(offline.exercises).toHaveLength(5);

    act(() => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => {
      const { view } = result.current;
      expect(view.status === "ready" && view.header.setsPlanned).toBe(LEGS_SETS + PRESS_SETS);
    });
    const online = await ready(result);
    expect(online.exercises).toHaveLength(6);
  });
});

describe("useSessionView describing an exercise the suggestion added", () => {
  const cableFly = {
    id: "00000001-0000-4000-8000-0000000000aa",
    name: "Cable fly",
    equipment: "cable",
    mechanic: "isolation",
  } as const;
  const flyMuscles = [{ muscle_id: "chest_lower", role: "primary", weight: 1 }] as const;
  const flyExercise = {
    id: cableFly.id,
    position: 0,
    exercise_id: cableFly.id,
    target_sets: 3,
    target_rir: 2,
    rep_min: 12,
    rep_max: 15,
    exercise: cableFly,
    muscles: [...flyMuscles],
    snapshot: buildSetSnapshot(cableFly, [...flyMuscles]),
  };

  it("should take the muscle map from the stored row for an exercise the routine does not hold", async () => {
    const { result } = renderView({ rows: [acceptedRow({ exercises: [flyExercise] })] });

    const view = await ready(result);

    const fly = view.exercises.find(({ exercise }) => exercise.exerciseId === cableFly.id);
    expect(fly?.name).toBe("Cable fly");
    expect(fly?.muscles).toStrictEqual(flyMuscles);
    expect(fly?.plan).toMatchObject({ sets: 3, repMin: 12, repMax: 15, rir: 2 });
  });

  it("should draw the equipment alone, with no plan, for a row stored before the rep range was kept", async () => {
    const { rep_min, rep_max, ...withoutRange } = flyExercise;
    expect([rep_min, rep_max]).toStrictEqual([12, 15]);
    const { result } = renderView({ rows: [acceptedRow({ exercises: [withoutRange] })] });

    const view = await ready(result);

    const fly = view.exercises.find(({ exercise }) => exercise.exerciseId === cableFly.id);
    expect(fly?.plan).toBeNull();
    expect(fly?.target).toBe(describeExerciseTarget({ target: null, equipment: "cable" }));
    expect(fly?.exercise.rows).toHaveLength(3);
    expect(view.header.setsPlanned).toBe(LEGS_SETS + 3);
  });
});
