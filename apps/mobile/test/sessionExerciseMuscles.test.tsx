import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";

import { createDiaryQueryClient } from "./support/diaryBackend";
import {
  exerciseIdOf,
  freshLegsOpen,
  goldenLegsOpen,
  legsRoutine,
  snapshotOf,
} from "./support/sessionGoldenLegs";
import { resetTrainBackend, trainBackend, trainClient } from "./support/trainBackend";
import { useSessionScreen } from "../components/SessionScreen/useSessionScreen";

import type { ChosenExercise } from "../components/AddExerciseSheet";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const QUADS_ONLY = [{ muscle_id: "quads", role: "primary", weight: 1 }];
const OTHER_DAY_ID = "00000006-0000-4000-8000-000000000092";
const ADDED_EXERCISE: ChosenExercise = {
  id: "00000006-0000-4000-8000-000000000099",
  name: "Cable fly",
  equipment: "cable",
  mechanic: "isolation",
  source: "free_exercise_db",
  primary_muscles: ["quads"],
  secondary_muscles: [],
};

let queryClient: QueryClient;

async function renderScreenModel() {
  queryClient = createDiaryQueryClient();
  const rendered = await renderHook(() => useSessionScreen(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        {children}
      </KeyLowProvider>
    ),
  });
  await waitFor(() => {
    expect(rendered.result.current.status).toBe("ready");
  });

  return rendered;
}

/** The muscles of the card of the exercise, once the screen is ready. */
function musclesOf(view: ReturnType<typeof useSessionScreen>, exerciseId: string): unknown {
  if (view.status !== "ready") {
    throw new Error("The screen is not ready");
  }
  const card = view.exercises.find((entry) => entry.exercise.exerciseId === exerciseId);
  if (card === undefined) {
    throw new Error("The screen has no card for the exercise");
  }

  return card.muscles;
}

describe("the muscle map of each exercise of the session screen", () => {
  beforeEach(() => {
    resetTrainBackend();
    trainBackend.routine = legsRoutine;
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should be the active routine's map for a planned exercise with no set saved yet", async () => {
    trainBackend.activeSession = freshLegsOpen("2026-10-15T18:30:00+01:00");

    const { result } = await renderScreenModel();

    expect(musclesOf(result.current, exerciseIdOf("squat"))).toEqual(QUADS_ONLY);
  });

  it("should be the saved set's snapshot map, even when the active routine has a different map", async () => {
    trainBackend.activeSession = goldenLegsOpen(undefined, [], "legs");

    const { result } = await renderScreenModel();

    expect(musclesOf(result.current, exerciseIdOf("squat"))).toEqual(
      snapshotOf("squat", "legs").muscles,
    );
  });

  it("should be the active routine's map when the session's day has left the routine but another day plans the exercise", async () => {
    const [legsDay] = legsRoutine["routine_days"] as readonly Record<string, unknown>[];
    trainBackend.routine = {
      ...legsRoutine,
      routine_days: [
        { ...legsDay, id: "00000006-0000-4000-8000-000000000093", routine_exercises: [] },
        { ...legsDay, id: OTHER_DAY_ID },
      ],
    };
    trainBackend.activeSession = freshLegsOpen("2026-10-15T18:30:00+01:00");
    const { result } = await renderScreenModel();

    await act(() => {
      if (result.current.status === "ready") {
        result.current.addExercise({
          ...ADDED_EXERCISE,
          id: exerciseIdOf("squat"),
          name: "Barbell squat",
        });
      }
    });

    await waitFor(() => {
      expect(musclesOf(result.current, exerciseIdOf("squat"))).toEqual(QUADS_ONLY);
    });
  });

  it("should be null for an exercise added on screen that no routine day plans and has no set saved", async () => {
    trainBackend.activeSession = freshLegsOpen("2026-10-15T18:30:00+01:00");
    const { result } = await renderScreenModel();

    await act(() => {
      if (result.current.status === "ready") {
        result.current.addExercise(ADDED_EXERCISE);
      }
    });

    await waitFor(() => {
      expect(musclesOf(result.current, ADDED_EXERCISE.id)).toBeNull();
    });
  });
});
