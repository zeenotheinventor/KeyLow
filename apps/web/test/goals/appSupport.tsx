import { KeyLowProvider } from "@keylow/api-client";
import { goalAnswersSchema } from "@keylow/core/training";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import { useLayoutEffect, useState } from "react";

import { goldenAnswers } from "./summarySupport";

import type { TrainingGoalsRow } from "@keylow/core/schemas";
import type { Mock } from "vitest";

import { GoalFlow, GoalQuestionRoute, GoalRoute, GoalSummaryRoute } from "@/components/goals";
import { ToastProvider } from "@/components/ui/Toast";

const GOLDEN_GOAL_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

/** The golden week's goal as the database holds it: look better, V-taper, 4 days, 60 minutes, full gym, intermediate. */
export const goldenGoalRow: TrainingGoalsRow = {
  id: GOLDEN_GOAL_ID,
  user_id: USER_ID,
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [...goldenAnswers.equipment],
  experience: "intermediate",
  muscle_priority: {},
  params_version: "v1",
  effective_from: "2026-09-21T08:00:00+00:00",
  effective_to: null,
  created_at: "2026-09-21T08:00:00+00:00",
};

/** A database that keeps every goal row, as the real one does, and closes the current row on a save. */
export const appBackend: {
  /** Every row of `training_goals`, the current one with no `effective_to`. */
  rows: TrainingGoalsRow[];
  /** `ready` answers the goal read, `pending` never answers. */
  read: "ready" | "pending";
  /** The goals sent to `save_training_goals`, one entry for each call. */
  saves: unknown[];
} = { rows: [], read: "ready", saves: [] };

export function resetAppBackend(rows: TrainingGoalsRow[] = []): void {
  appBackend.rows = rows;
  appBackend.read = "ready";
  appBackend.saves = [];
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const SAVED_AT = "2026-11-05T09:00:00+00:00";

// The goal the app sends holds the six answers, which the repository's own tests check.
async function readSentAnswers(request: Request) {
  const body: unknown = JSON.parse(await request.text());
  return goalAnswersSchema.parse(
    typeof body === "object" && body !== null && "p_goals" in body ? body.p_goals : undefined,
  );
}

async function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);

  if (url.pathname.endsWith("/profiles")) {
    return json([{ timezone: "UTC" }]);
  }
  if (url.pathname.endsWith("/rpc/save_training_goals")) {
    const sent = await readSentAnswers(request);
    appBackend.saves.push(sent);
    const id = `00000000-0000-4000-8000-00000000000${appBackend.rows.length + 1}`;
    appBackend.rows = [
      ...appBackend.rows.map((row) => ({ ...row, effective_to: row.effective_to ?? SAVED_AT })),
      {
        ...sent,
        muscle_priority: {},
        params_version: "v1",
        id,
        user_id: USER_ID,
        effective_from: SAVED_AT,
        effective_to: null,
        created_at: SAVED_AT,
      },
    ];
    return json(id);
  }
  if (url.pathname.endsWith("/training_goals")) {
    if (appBackend.read === "pending") {
      return new Promise<Response>(() => undefined);
    }
    const id = url.searchParams.get("id")?.replace("eq.", "");
    if (id !== undefined) {
      return json(appBackend.rows.find((row) => row.id === id));
    }
    return json(appBackend.rows.filter((row) => row.effective_to === null));
  }
  return json([]);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

/** The pieces of the router the goal screens use. */
export type AppRouter = {
  push: Mock<(href: string) => void>;
  replace: Mock<(href: string) => void>;
  back: Mock<() => void>;
};

/** The addresses the person has been through, and where in them they are, as the browser keeps them. */
export const visited: { entries: string[]; index: number } = { entries: [], index: 0 };

/** The address the person is at. */
export const currentAddress = (): string => visited.entries[visited.index] ?? "";

/** The browser's own Back and Forward buttons, which the app's router does not see as its own calls. */
export const browser: { back: () => void; forward: () => void } = {
  back: () => undefined,
  forward: () => undefined,
};

type History = { entries: string[]; index: number };

/**
 * The goal part of the app: the real layout around the real routes, with the address and the history held
 * in state so that push, replace and back on the router mock move between pages as the browser does, and
 * the browser's Back and Forward too. Each page is keyed by its address, so it mounts anew when reached, while
 * the layout above stays mounted for as long as the address is under /goal. More and Train are stand-ins
 * outside the layout, so leaving the flow drops its answers. A page reads its `from` and `origin` parameters as the route
 * files do.
 */
function GoalApp({ entries, router }: { entries: string[]; router: AppRouter }) {
  const [history, setHistory] = useState<History>({ entries, index: entries.length - 1 });
  const address = history.entries[history.index] ?? "";
  const [path = "", query = ""] = address.split("?");
  const params = new URLSearchParams(query);
  const from = params.get("from") ?? undefined;
  const origin = params.get("origin") ?? undefined;

  useLayoutEffect(() => {
    visited.entries = history.entries;
    visited.index = history.index;
  }, [history]);

  useLayoutEffect(() => {
    const move = (change: number) => {
      setHistory((current) => ({
        ...current,
        index: Math.min(Math.max(current.index + change, 0), current.entries.length - 1),
      }));
    };
    router.push.mockImplementation((href) => {
      setHistory((current) => ({
        entries: [...current.entries.slice(0, current.index + 1), href],
        index: current.index + 1,
      }));
    });
    router.replace.mockImplementation((href) => {
      setHistory((current) => ({
        ...current,
        entries: current.entries.map((entry, index) => (index === current.index ? href : entry)),
      }));
    });
    router.back.mockImplementation(() => {
      move(-1);
    });
    browser.back = () => {
      act(() => {
        move(-1);
      });
    };
    browser.forward = () => {
      act(() => {
        move(1);
      });
    };
  }, [router]);

  if (path === "/more") {
    return <p>The More page</p>;
  }
  if (path === "/train") {
    return <p>The Train page</p>;
  }

  const segment = path.split("/").at(-1) ?? "";
  const page =
    path === "/goal" ? (
      <GoalRoute key={address} from={from} />
    ) : segment === "summary" ? (
      <GoalSummaryRoute key={address} origin={origin} />
    ) : (
      <GoalQuestionRoute key={address} step={segment} from={from} origin={origin} />
    );

  return <GoalFlow>{page}</GoalFlow>;
}

/** Renders the goal part of the app over the fake database, with `entries` as the pages already visited. */
export function renderGoalApp(router: AppRouter, entries: string[] = ["/more", "/goal"]) {
  // A failed read is shown at once, where the app's own client would try it again first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    ...render(
      <KeyLowProvider client={client} queryClient={queryClient}>
        <ToastProvider>
          <GoalApp entries={entries} router={router} />
        </ToastProvider>
      </KeyLowProvider>,
    ),
    queryClient,
  };
}
