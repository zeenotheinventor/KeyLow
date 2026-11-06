import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useEffect, useState } from "react";

import type { Mock } from "vitest";

import { SetupFlow, SetupRoute, useSetupFlow } from "@/components/setup";
import { readSetupMode } from "@/lib/setupRoutes";

/** The saved setup as the database holds it, which a test changes between renders. */
export const setupBackend: {
  /** `ready` answers, `pending` never answers, `error` fails. */
  status: "ready" | "pending" | "error";
  profile: Record<string, unknown> | null;
  program: Record<string, unknown> | null;
  weighIn: Record<string, unknown> | null;
  /** How many times the setup state was read (its profile request). */
  reads: number;
} = { status: "ready", profile: null, program: null, weighIn: null, reads: 0 };

export function resetSetupBackend(): void {
  setupBackend.status = "ready";
  setupBackend.profile = null;
  setupBackend.program = null;
  setupBackend.weighIn = null;
  setupBackend.reads = 0;
}

/** A profile that has been set up, with the golden sample's answers: male, born 14 March 1991, 180 cm. */
export const savedProfile = {
  sex: "male",
  birth_date: "1991-03-14",
  height_cm: 180,
  activity: "light",
  weight_unit: "kg",
  onboarding_completed_at: "2026-10-01T09:00:00+00:00",
};

/** The golden sample's weigh-in on 21 October. */
export const savedWeighIn = { weight_kg: 80, local_date: "2026-10-21" };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname } = new URL(request.url);
  const rows: Record<string, Record<string, unknown> | null> = {
    "/rest/v1/profiles": setupBackend.profile,
    "/rest/v1/programs": setupBackend.program,
    "/rest/v1/weigh_ins": setupBackend.weighIn,
  };
  if (!(pathname in rows)) {
    return Promise.resolve(json([]));
  }
  if (pathname.endsWith("/profiles")) {
    setupBackend.reads += 1;
  }
  if (setupBackend.status === "pending") {
    return new Promise(() => undefined);
  }
  if (setupBackend.status === "error") {
    return Promise.resolve(json({ code: "XX000", message: "down", details: "", hint: "" }, 500));
  }
  const row = rows[pathname] ?? null;
  const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;
  return Promise.resolve(wantsObject ? json(row) : json(row === null ? [] : [row]));
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

/** The pieces of the router a flow test watches: where the wizard was sent. */
export type FlowRouter = {
  push: Mock<(href: string) => void>;
  replace: Mock<(href: string) => void>;
};

/** What the reducer thinks the step is, for a test that checks `stepOpened` reached it. */
function StepProbe() {
  const { state } = useSetupFlow();
  return <output aria-label="Reducer step">{state.step}</output>;
}

/**
 * The wizard as the app draws it: the real layout's flow around the real route, with the address held in
 * state so that a push or a replace on the router mock moves to the step it names, as the browser does,
 * while the flow stays mounted. A new step is a new page, so the route is keyed by its path.
 */
function Flow({
  startAt,
  router,
  registerGoTo,
}: {
  startAt: string;
  router: FlowRouter;
  registerGoTo: (goTo: (address: string) => void) => void;
}) {
  const [address, setAddress] = useState(startAt);
  const { pathname, searchParams } = new URL(address, "http://localhost");
  const segment = pathname.split("/")[2];

  useEffect(() => {
    router.push.mockImplementation(setAddress);
    router.replace.mockImplementation(setAddress);
    registerGoTo(setAddress);
  }, [router, registerGoTo]);

  return (
    <SetupFlow>
      <StepProbe />
      <SetupRoute
        key={pathname}
        segment={segment}
        mode={readSetupMode(searchParams.get("mode") ?? undefined)}
      />
    </SetupFlow>
  );
}

export function renderSetupFlow(router: FlowRouter, startAt = "/setup?mode=first-run") {
  // A failed read is shown at once, where the app's own client would try it again first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let goTo: (address: string) => void = () => undefined;

  return {
    ...render(
      <KeyLowProvider client={client} queryClient={queryClient}>
        <Flow
          startAt={startAt}
          router={router}
          registerGoTo={(next) => {
            goTo = next;
          }}
        />
      </KeyLowProvider>,
    ),
    queryClient,
    /** Moves the address as the browser's Back does, with no call on the router. */
    goTo: (address: string) => {
      goTo(address);
    },
  };
}
