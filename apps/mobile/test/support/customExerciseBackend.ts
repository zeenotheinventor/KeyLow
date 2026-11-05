import { createClient } from "@supabase/supabase-js";

import { trainBackend, trainFetch } from "./trainBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

export const SAVED_EXERCISE_ID = "0000000b-0000-4000-8000-000000000001";

/**
 * The `save_exercise` function of the database, on top of the training backend. It stores the exercise in the
 * rows the search and the read-back answer from, so a saved exercise is found where a real one would be.
 */
export const customExerciseBackend: {
  /** What each call of `save_exercise` was given, in order. */
  saves: Row[];
  /** Fails the save with a database error. */
  failing: boolean;
  /** Holds the answer until the test calls it, so a test can look at the form while the save is on its way. */
  hold: Promise<void> | null;
} = { saves: [], failing: false, hold: null };

export function resetCustomExerciseBackend(): void {
  customExerciseBackend.saves = [];
  customExerciseBackend.failing = false;
  customExerciseBackend.hold = null;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;

async function saveExercise(init?: RequestInit): Promise<Response> {
  const parsed: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  const body = isRow(parsed) ? parsed : {};
  customExerciseBackend.saves.push(body);
  if (customExerciseBackend.hold !== null) {
    await customExerciseBackend.hold;
  }
  if (customExerciseBackend.failing) {
    return jsonResponse(
      { code: "XX000", message: "raw database text", details: null, hint: null },
      500,
    );
  }
  const exercise = isRow(body["p_exercise"]) ? body["p_exercise"] : {};
  trainBackend.exercises = [
    {
      id: SAVED_EXERCISE_ID,
      name: exercise["name"],
      equipment: exercise["equipment"],
      mechanic: exercise["mechanic"],
      source: "user",
      exercise_muscles: body["p_muscles"],
    },
    ...trainBackend.exercises,
  ];
  return jsonResponse(SAVED_EXERCISE_ID);
}

async function customExerciseFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (new URL(address).pathname.endsWith("/rpc/save_exercise")) {
    return saveExercise(init);
  }
  return trainFetch(input, init);
}

/** A real Supabase client whose network is the training backend plus `save_exercise`. */
export const customExerciseClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: customExerciseFetch },
});
