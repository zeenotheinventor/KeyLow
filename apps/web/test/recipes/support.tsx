import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { RecipeSummary } from "@keylow/api-client";
import type { ReactElement } from "react";

type RecipesBackend = {
  /** What the recipes table holds, live and archived. */
  rows: RecipeSummary[];
  /** Answers the read with a server error. */
  fails: boolean;
  /** Never answers the read, as a slow connection does. */
  hangs: boolean;
  /** The URLs of the reads of the recipes table, in order. */
  reads: string[];
};

export const recipesBackend: RecipesBackend = { rows: [], fails: false, hangs: false, reads: [] };

export function resetRecipesBackend(): void {
  recipesBackend.rows = [];
  recipesBackend.fails = false;
  recipesBackend.hangs = false;
  recipesBackend.reads = [];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, search } = new URL(request.url);

  if (!pathname.endsWith("/recipes") || request.method !== "GET") {
    return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
  }

  recipesBackend.reads.push(`${pathname}${search}`);

  if (recipesBackend.hangs) {
    return new Promise<Response>(() => undefined);
  }
  if (recipesBackend.fails) {
    return Promise.resolve(
      jsonResponse(
        { code: "XX000", message: "database unavailable", details: null, hint: null },
        500,
      ),
    );
  }

  const onlyLive = search.includes("is_archived=eq.false");
  const rows = recipesBackend.rows.filter((row) => !onlyLive || !row.is_archived);
  return Promise.resolve(jsonResponse(rows));
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithRecipes(ui: ReactElement) {
  // A failed read is shown at once, where the app's own client would try it three more times first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return renderWithRouter(
    <KeyLowProvider client={client} queryClient={queryClient}>
      {ui}
    </KeyLowProvider>,
  );
}
