import { KeyLowProvider } from "@keylow/api-client";
import { BODY_ARTWORK } from "@keylow/core/training";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useEffect } from "react";

import type { BodyArtworkFigure, GoalDraftAnswers, MuscleId } from "@keylow/core/training";
import type { Mock } from "vitest";

import { GoalDraftProvider, useGoalDraft } from "@/components/goals/GoalDraftProvider";
import { GoalSummaryRoute } from "@/components/goals/GoalSummaryRoute";
import { ToastProvider } from "@/components/ui/Toast";

/** The golden week's answers of the board: look better, V-taper, 4 days, 60 minutes, full gym, intermediate. */
export const goldenAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [
    "barbell",
    "dumbbell",
    "kettlebell",
    "cable",
    "machine",
    "smith_machine",
    "ez_bar",
    "band",
    "bodyweight",
  ],
  experience: "intermediate",
} as const satisfies GoalDraftAnswers;

/** What the database answers to the reads and the save of the summary, which a test changes between renders. */
export const summaryBackend: {
  /** `ready` answers with `routineMuscles`, `pending` holds the answer until `releaseRoutineReads`, `error` fails. */
  routine: "ready" | "pending" | "error";
  /** The muscles the active routine works, or `null` for no active routine. */
  routineMuscles: readonly MuscleId[] | null;
  /** `ready` stores the goal, `pending` never answers, `error` fails. */
  save: "ready" | "pending" | "error";
  /** The goals sent to `save_training_goals`, one entry for each call. */
  saved: unknown[];
  /** Answers the routine reads that are waiting, as `pending` leaves them. */
  waitingRoutineReads: Array<() => void>;
} = { routine: "ready", routineMuscles: null, save: "ready", saved: [], waitingRoutineReads: [] };

/** Answers every routine read that is waiting, as a slow connection finally does. */
export function releaseRoutineReads(): void {
  summaryBackend.routine = "ready";
  for (const release of summaryBackend.waitingRoutineReads.splice(0)) {
    release();
  }
}

export function resetSummaryBackend(): void {
  summaryBackend.routine = "ready";
  summaryBackend.routineMuscles = null;
  summaryBackend.save = "ready";
  summaryBackend.saved = [];
  summaryBackend.waitingRoutineReads = [];
}

const NEW_GOAL_ID = "33333333-3333-4333-8333-333333333333";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const databaseError = () => json({ code: "XX000", message: "down", details: "", hint: "" }, 500);

// A routine with one exercise that works the given muscles, which is what makes them kept up.
const routineRow = (muscles: readonly MuscleId[]) => ({
  id: "44444444-4444-4444-8444-444444444444",
  name: "Routine",
  activated_at: "2026-09-21T08:00:00+00:00",
  routine_days: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Day",
      position: 0,
      weekday: null,
      routine_exercises: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          position: 0,
          exercise_id: "77777777-7777-4777-8777-777777777777",
          target_sets: 3,
          target_rir: 2,
          exercises: {
            id: "77777777-7777-4777-8777-777777777777",
            name: "Everything",
            equipment: "cable",
            mechanic: "isolation",
            exercise_muscles: muscles.map((muscle_id) => ({
              muscle_id,
              role: "primary",
              weight: 1,
            })),
          },
        },
      ],
    },
  ],
});

// The row `save_training_goals` stored, as it is read back after the call.
const storedRow = {
  id: NEW_GOAL_ID,
  user_id: "22222222-2222-4222-8222-222222222222",
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: goldenAnswers.equipment,
  experience: "intermediate",
  muscle_priority: {},
  params_version: "v1",
  effective_from: "2026-11-05T08:00:00+00:00",
  effective_to: null,
  created_at: "2026-11-05T08:00:00+00:00",
};

async function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname } = new URL(request.url);

  if (pathname.endsWith("/rpc/save_training_goals")) {
    summaryBackend.saved.push(await request.json());
    switch (summaryBackend.save) {
      case "pending":
        return new Promise<Response>(() => undefined);
      case "error":
        return databaseError();
      case "ready":
        return json(NEW_GOAL_ID);
    }
  }
  if (pathname.endsWith("/routines")) {
    const answer = () =>
      summaryBackend.routineMuscles === null ? [] : [routineRow(summaryBackend.routineMuscles)];
    switch (summaryBackend.routine) {
      case "pending":
        return new Promise<Response>((resolve) => {
          summaryBackend.waitingRoutineReads.push(() => {
            resolve(json(answer()));
          });
        });
      case "error":
        return databaseError();
      case "ready":
        return json(answer());
    }
  }
  if (pathname.endsWith("/training_goals")) {
    // The row read back after the save is asked for as one object, the current goal as at most one.
    const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;
    return json(wantsObject ? storedRow : [storedRow]);
  }
  return json([]);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

/** The pieces of the router the summary uses. */
export type SummaryRouter = {
  push: Mock<(href: string) => void>;
  replace: Mock<(href: string) => void>;
  back: Mock<() => void>;
};

/** Gives the answers the person changed to, once the flow is open, as a question would. */
function ChangeAnswers({ answers }: { answers: GoalDraftAnswers }) {
  const { answer } = useGoalDraft();
  useEffect(() => {
    answer(answers);
  }, [answer, answers]);
  return null;
}

/**
 * The summary as the app draws it: the real route inside the flow's answers and the toast host. The flow
 * opens with a goal that differs from `answers` in one answer and then gives `answers`, so the person has
 * changed something and Save goal is drawn. With `isChanged: false` the flow opens with `answers` as they
 * are, as it does for a stored goal that nothing has changed.
 */
export function renderGoalSummary(
  answers: GoalDraftAnswers = goldenAnswers,
  { isChanged = true }: { isChanged?: boolean } = {},
) {
  // A failed read is shown at once, where the app's own client would try it again first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const changesAnAnswer = isChanged && answers.experience !== undefined;
  const opened: GoalDraftAnswers = changesAnAnswer
    ? { ...answers, experience: answers.experience === "beginner" ? "advanced" : "beginner" }
    : answers;

  return {
    ...render(
      <KeyLowProvider client={client} queryClient={queryClient}>
        <ToastProvider>
          <GoalDraftProvider initialAnswers={opened}>
            {changesAnAnswer ? <ChangeAnswers answers={answers} /> : null}
            <GoalSummaryRoute />
          </GoalDraftProvider>
        </ToastProvider>
      </KeyLowProvider>,
    ),
    queryClient,
  };
}

/**
 * The fill class of a muscle's drawing on a figure, which tells what value it was drawn with. A figure with
 * no handler is one image, so its muscles have no role to ask for and are found by their drawing.
 */
export function fillClassOf(
  figure: HTMLElement,
  side: "front" | "back",
  muscle: MuscleId,
  body: BodyArtworkFigure = "male",
): string {
  const drawing = Object.entries(BODY_ARTWORK[body][side].muscles).find(([id]) => id === muscle);
  if (drawing === undefined) {
    return "";
  }
  return figure.querySelector(`path[d="${drawing[1]}"]`)?.getAttribute("class") ?? "";
}
