import { onlineManager } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useAddSet } from "../../src/hooks/useAddSet";
import { useArchiveExercise } from "../../src/hooks/useArchiveExercise";
import { useArchiveRoutine } from "../../src/hooks/useArchiveRoutine";
import { useDeleteSession } from "../../src/hooks/useDeleteSession";
import { useFinishSession } from "../../src/hooks/useFinishSession";
import { useRemoveSet } from "../../src/hooks/useRemoveSet";
import { useReorderSets } from "../../src/hooks/useReorderSets";
import { useRestoreSet } from "../../src/hooks/useRestoreSet";
import { useSaveExercise } from "../../src/hooks/useSaveExercise";
import { useSaveRoutine } from "../../src/hooks/useSaveRoutine";
import { useSaveTrainingGoals } from "../../src/hooks/useSaveTrainingGoals";
import { useSetActiveRoutine } from "../../src/hooks/useSetActiveRoutine";
import { useStartSession } from "../../src/hooks/useStartSession";
import { useUpdateSet } from "../../src/hooks/useUpdateSet";
import { DAY_ID, EXERCISE_ID, ROUTINE_ID } from "../support/routines";
import { OPEN_SESSION_ID } from "../support/sessionWrites";
import { SET_IDS, SET_SESSION_ID } from "../support/setWrites";
import { vTaperAnswers } from "../support/trainingGoals";
import { createWrapper } from "../support/wrapper";

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

const [FIRST_SET_ID, SECOND_SET_ID] = SET_IDS;

function useEveryTrainingWrite() {
  return {
    startSession: useStartSession(),
    finishSession: useFinishSession(),
    deleteSession: useDeleteSession(),
    addSet: useAddSet(),
    updateSet: useUpdateSet(),
    removeSet: useRemoveSet(),
    restoreSet: useRestoreSet(),
    reorderSets: useReorderSets(),
    saveExercise: useSaveExercise(),
    archiveExercise: useArchiveExercise(),
    saveTrainingGoals: useSaveTrainingGoals(),
    saveRoutine: useSaveRoutine(),
    archiveRoutine: useArchiveRoutine(),
    setActiveRoutine: useSetActiveRoutine(),
  };
}

type EveryTrainingWrite = ReturnType<typeof useEveryTrainingWrite>;

const writes: readonly (readonly [string, (hooks: EveryTrainingWrite) => Promise<unknown>])[] = [
  ["useStartSession", (hooks) => hooks.startSession.mutateAsync({ now: new Date(), tz: "UTC" })],
  [
    "useFinishSession",
    (hooks) =>
      hooks.finishSession.mutateAsync({ id: OPEN_SESSION_ID, endedAt: new Date(), note: null }),
  ],
  ["useDeleteSession", (hooks) => hooks.deleteSession.mutateAsync(OPEN_SESSION_ID)],
  [
    "useAddSet",
    (hooks) =>
      hooks.addSet.mutateAsync({
        sessionId: SET_SESSION_ID,
        exerciseId: EXERCISE_ID,
        draft: { setType: "working", load: "60", reps: "8", rir: "2", rpe: "" },
        unit: "kg",
        effortMode: "rir",
        now: new Date(),
      }),
  ],
  [
    "useUpdateSet",
    (hooks) => hooks.updateSet.mutateAsync({ id: FIRST_SET_ID, patch: { reps: 10 } }),
  ],
  ["useRemoveSet", (hooks) => hooks.removeSet.mutateAsync(FIRST_SET_ID)],
  ["useRestoreSet", (hooks) => hooks.restoreSet.mutateAsync(FIRST_SET_ID)],
  [
    "useReorderSets",
    (hooks) =>
      hooks.reorderSets.mutateAsync({
        sessionId: SET_SESSION_ID,
        orderedIds: [SECOND_SET_ID, FIRST_SET_ID],
      }),
  ],
  [
    "useSaveExercise",
    (hooks) =>
      hooks.saveExercise.mutateAsync({
        draft: {
          name: "Cable raise",
          equipment: "cable",
          muscles: [{ muscle_id: "delt_side", role: "primary" }],
        },
      }),
  ],
  ["useArchiveExercise", (hooks) => hooks.archiveExercise.mutateAsync(EXERCISE_ID)],
  ["useSaveTrainingGoals", (hooks) => hooks.saveTrainingGoals.mutateAsync(vTaperAnswers)],
  [
    "useSaveRoutine",
    (hooks) =>
      hooks.saveRoutine.mutateAsync({
        id: null,
        draft: {
          name: "Push Pull Legs",
          days: [
            {
              id: DAY_ID,
              weekday: 0,
              name: "Push",
              exercises: [
                {
                  exercise_id: EXERCISE_ID,
                  target_sets: 3,
                  rep_min: 8,
                  rep_max: 12,
                  target_rir: null,
                },
              ],
            },
          ],
        },
      }),
  ],
  [
    "useArchiveRoutine",
    (hooks) => hooks.archiveRoutine.mutateAsync({ id: ROUTINE_ID, archived: true }),
  ],
  ["useSetActiveRoutine", (hooks) => hooks.setActiveRoutine.mutateAsync(ROUTINE_ID)],
];

const MOMENT_MILLISECONDS = 50;

describe("a training write made while the phone is offline", () => {
  beforeEach(() => {
    onlineManager.setOnline(false);
  });

  // A paused mutation is held until the connection returns and is then replayed, which a training write
  // must never be: it needs a connection and is never queued. The write is started instead, and it fails
  // on the network or the rule, so the screen's error path shows.
  it.each(writes)(
    "should start at once, not wait to be replayed, when %s is called",
    async (_, write) => {
      const { queryClient, wrapper } = createWrapper();
      const { result } = renderHook(useEveryTrainingWrite, { wrapper });

      // The write is left to fail in its own time: a read inside it can wait out its retries.
      void write(result.current).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, MOMENT_MILLISECONDS));

      const [mutation, ...others] = queryClient.getMutationCache().getAll();
      expect(others).toEqual([]);
      expect(mutation?.state.isPaused).toBe(false);
    },
  );
});
