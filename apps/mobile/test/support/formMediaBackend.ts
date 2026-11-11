import { createClient } from "@supabase/supabase-js";

import { trainFetch } from "./trainBackend";

import type { Database } from "@keylow/api-client";
import type { ExerciseFormMediaRow } from "@keylow/core/training";

/** What the fake server does with a read of the `exercise_form_media` function. */
type FormMediaRead = "answer" | "fail" | "hang";

/** The rows the function answers for each exercise id, how it behaves and how often it was asked. */
export const formMediaBackend: {
  rowsByExercise: Record<string, ExerciseFormMediaRow>;
  read: FormMediaRead;
  reads: number;
} = { rowsByExercise: {}, read: "answer", reads: 0 };

export function resetFormMediaBackend(): void {
  formMediaBackend.rowsByExercise = {};
  formMediaBackend.read = "answer";
  formMediaBackend.reads = 0;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const exerciseIdOf = (init: RequestInit | undefined): string => {
  const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  return typeof body === "object" && body !== null && "p_exercise_id" in body
    ? String(body.p_exercise_id)
    : "";
};

/** The train backend's network with the form media function added to it. */
export const formMediaFetch: typeof fetch = (input, init) => {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!new URL(address).pathname.endsWith("/rpc/exercise_form_media")) {
    return trainFetch(input, init);
  }
  formMediaBackend.reads += 1;
  if (formMediaBackend.read === "hang") {
    return new Promise<Response>(() => undefined);
  }
  if (formMediaBackend.read === "fail") {
    return Promise.resolve(json({ code: "XX000", message: "raw", details: null, hint: null }, 500));
  }
  const row = formMediaBackend.rowsByExercise[exerciseIdOf(init)];
  return Promise.resolve(json(row === undefined ? [] : [row]));
};

/** A real Supabase client whose network is the fake database, with the form media function. */
export const formMediaClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: formMediaFetch },
});
