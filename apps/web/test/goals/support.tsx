import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useEffect, useState } from "react";

import type { TrainingGoalsRow } from "@keylow/core/schemas";
import type { ReactNode } from "react";
import type { Mock } from "vitest";

import { GoalFlow, GoalQuestionRoute } from "@/components/goals";

/** What the database answers to the current goal read, which a test changes between renders. */
export const goalsBackend: {
  /** `ready` answers with `row`, `pending` never answers, `error` fails. */
  status: "ready" | "pending" | "error";
  row: TrainingGoalsRow | null;
  /** How many times the goal was read. */
  reads: number;
  /** The same for the time zone of the profile, which dates the goal on the Goal row. */
  timeZoneStatus: "ready" | "pending" | "error";
  /** The profile's time zone, or `null` for a profile with none. */
  timeZone: string | null;
} = { status: "ready", row: null, reads: 0, timeZoneStatus: "ready", timeZone: "UTC" };

export function resetGoalsBackend(): void {
  goalsBackend.status = "ready";
  goalsBackend.row = null;
  goalsBackend.reads = 0;
  goalsBackend.timeZoneStatus = "ready";
  goalsBackend.timeZone = "UTC";
}

/** The golden week's goal as the database holds it, with every answer a question asks. */
export const storedGoalRow: TrainingGoalsRow = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  goal: "hybrid",
  focus: ["arms", "chest"],
  days_per_week: 5,
  session_minutes: 50,
  equipment: ["dumbbell", "cable", "other"],
  experience: "advanced",
  muscle_priority: {},
  params_version: "v1",
  effective_from: "2026-09-21T08:00:00+00:00",
  effective_to: null,
  created_at: "2026-09-21T08:00:00+00:00",
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const down = (): Response => json({ code: "XX000", message: "down", details: "", hint: "" }, 500);

function respondWithTimeZone(): Promise<Response> {
  switch (goalsBackend.timeZoneStatus) {
    case "pending":
      return new Promise(() => undefined);
    case "error":
      return Promise.resolve(down());
    case "ready":
      return Promise.resolve(
        json(goalsBackend.timeZone === null ? [] : [{ timezone: goalsBackend.timeZone }]),
      );
  }
}

function respond(input: string | URL | Request): Promise<Response> {
  const { pathname } = new URL(new Request(input).url);
  if (pathname.endsWith("/profiles")) {
    return respondWithTimeZone();
  }
  if (!pathname.endsWith("/training_goals")) {
    return Promise.resolve(json([]));
  }
  goalsBackend.reads += 1;
  switch (goalsBackend.status) {
    case "pending":
      return new Promise(() => undefined);
    case "error":
      return Promise.resolve(down());
    case "ready":
      return Promise.resolve(json(goalsBackend.row === null ? [] : [goalsBackend.row]));
  }
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input) => respond(input) },
});

/** The pieces of the router a flow test watches: where the flow was sent. */
export type FlowRouter = {
  push: Mock<(href: string) => void>;
  replace: Mock<(href: string) => void>;
};

/**
 * The goal flow as the app draws it: the real layout around the real question route, with the address held
 * in state so that a push or a replace on the router mock moves to the question it names, as the browser
 * does, while the layout above stays mounted. A new question is a new page, so the route is keyed by it.
 */
function Flow({ startAt, router }: { startAt: string; router: FlowRouter }) {
  const [path, setPath] = useState(startAt);
  const segment = path.split("/").at(-1) ?? "";

  useEffect(() => {
    router.push.mockImplementation(setPath);
    router.replace.mockImplementation(setPath);
  }, [router]);

  return (
    <GoalFlow>
      <GoalQuestionRoute key={segment} step={segment} />
    </GoalFlow>
  );
}

/** Renders `ui` with the app's data layer over the fake database. */
export function renderWithGoals(ui: ReactNode) {
  // A failed read is shown at once, where the app's own client would try it again first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    ...render(
      <KeyLowProvider client={client} queryClient={queryClient}>
        {ui}
      </KeyLowProvider>,
    ),
    queryClient,
  };
}

export function renderGoalFlow(router: FlowRouter, startAt = "/goal/1") {
  return renderWithGoals(<Flow startAt={startAt} router={router} />);
}
