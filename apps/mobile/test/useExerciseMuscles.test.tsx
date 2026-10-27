import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";

import { createDiaryQueryClient } from "./support/diaryBackend";
import { resetTrainBackend, trainBackend, trainFetch } from "./support/trainBackend";
import { useExerciseMuscles } from "../components/SessionScreen/useExerciseMuscles";

import type { Database } from "@keylow/api-client";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const PRESS_ID = "00000000-0000-4000-8000-000000000a01";
const SQUAT_MUSCLES: readonly ExerciseMuscleEntry[] = [
  // In the muscle list's order, which is the order the read returns.
  { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
  { muscle_id: "quads", role: "primary", weight: 1 },
  { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
];
const KNOWN_MUSCLES: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "chest_upper", role: "primary", weight: 1 },
];

// Every read of one exercise by its id that the client makes, and whether the server should fail it.
let exerciseReads = 0;
let failExerciseReads = false;

const countingFetch: typeof fetch = (input, init) => {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  if (url.pathname.endsWith("/exercises") && url.searchParams.has("id")) {
    exerciseReads += 1;
    if (failExerciseReads) {
      return Promise.resolve(
        new Response(JSON.stringify({ code: "XX000", message: "raw", details: null, hint: null }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
  }

  return trainFetch(input, init);
};

const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: countingFetch },
});

let queryClient: QueryClient;

function renderMuscles(options: { known: readonly ExerciseMuscleEntry[] | null; isOpen: boolean }) {
  queryClient = createDiaryQueryClient();

  return renderHook(
    (props: { isOpen: boolean }) =>
      useExerciseMuscles({ exerciseId: PRESS_ID, known: options.known, isOpen: props.isOpen }),
    {
      initialProps: { isOpen: options.isOpen },
      wrapper: ({ children }: { children: ReactNode }) => (
        <KeyLowProvider client={client} queryClient={queryClient}>
          {children}
        </KeyLowProvider>
      ),
    },
  );
}

describe("useExerciseMuscles", () => {
  beforeEach(() => {
    resetTrainBackend();
    exerciseReads = 0;
    failExerciseReads = false;
    trainBackend.exercises = [
      {
        id: PRESS_ID,
        name: "Bench press",
        equipment: "barbell",
        mechanic: "compound",
        source: "free_exercise_db",
        exercise_muscles: SQUAT_MUSCLES,
      },
    ];
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should be ready with the known map and make no request, even when the sheet is open", async () => {
    const { result } = await renderMuscles({ known: KNOWN_MUSCLES, isOpen: true });

    expect(result.current).toEqual({ status: "ready", muscles: KNOWN_MUSCLES });
    await act(() => Promise.resolve());
    expect(exerciseReads).toBe(0);
  });

  it("should make no request while the sheet is closed", async () => {
    const { result } = await renderMuscles({ known: null, isOpen: false });

    await act(() => Promise.resolve());
    expect(result.current).toEqual({ status: "loading" });
    expect(exerciseReads).toBe(0);
  });

  it("should be loading, then ready with the fetched map, once the sheet opens online", async () => {
    const { result, rerender } = await renderMuscles({ known: null, isOpen: false });

    await rerender({ isOpen: true });

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => {
      expect(result.current).toEqual({ status: "ready", muscles: SQUAT_MUSCLES });
    });
    expect(exerciseReads).toBe(1);
  });

  it("should be offline when the sheet opens with no connection and nothing fetched", async () => {
    await act(() => {
      onlineManager.setOnline(false);
    });
    const { result } = await renderMuscles({ known: null, isOpen: true });

    await waitFor(() => {
      expect(result.current).toEqual({ status: "offline" });
    });
    expect(exerciseReads).toBe(0);
  });

  it("should be failed when the read fails", async () => {
    failExerciseReads = true;
    const { result } = await renderMuscles({ known: null, isOpen: true });

    await waitFor(() => {
      expect(result.current).toEqual({ status: "failed" });
    });
  });

  it("should be failed when the exercise is not found", async () => {
    trainBackend.exercises = [];
    const { result } = await renderMuscles({ known: null, isOpen: true });

    await waitFor(() => {
      expect(result.current).toEqual({ status: "failed" });
    });
  });
});
