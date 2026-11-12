import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";

import type { RecipeSummary } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";
import type { ReactElement } from "react";

import { ToastProvider } from "@/components/ui/Toast";

type FavouritesBackend = {
  /** The foods the database knows, by id, which a favourite is listed with. */
  foods: Map<string, Food>;
  /** The recipes the database knows, by id. */
  recipes: Map<string, RecipeSummary>;
  /** The favourite foods, newest first. Undefined until a test sets them. */
  favouriteFoodIds: string[];
  favouriteRecipeIds: string[];
  /** Answers the favourite reads with a server error. */
  failsReads: boolean;
  /** Answers the read of one favourite table only with a server error, and the other normally. */
  failsReadsOf: "food_favourites" | "recipe_favourites" | undefined;
  /** Never answers the favourite reads, as a read paused offline does not. */
  hangsReads: boolean;
  /** Answers a write with a server error, or with the database's refusal of a 31st favourite. */
  writeOutcome: "saves" | "fails" | "refusesLimit";
  /** A write waits until `releaseWrites` is called, as a slow connection holds it. */
  holdsWrites: boolean;
  /** The requests the page made to the favourite tables, in order. */
  requests: { method: string; table: string; foodOrRecipeId: string | null }[];
};

export const favouritesBackend: FavouritesBackend = {
  foods: new Map(),
  recipes: new Map(),
  favouriteFoodIds: [],
  favouriteRecipeIds: [],
  failsReads: false,
  failsReadsOf: undefined,
  hangsReads: false,
  writeOutcome: "saves",
  holdsWrites: false,
  requests: [],
};

let releaseHeldWrites: (() => void) | undefined;
let heldWrites: Promise<void> = Promise.resolve();

export function resetFavouritesBackend(): void {
  favouritesBackend.foods = new Map();
  favouritesBackend.recipes = new Map();
  favouritesBackend.favouriteFoodIds = [];
  favouritesBackend.favouriteRecipeIds = [];
  favouritesBackend.failsReads = false;
  favouritesBackend.failsReadsOf = undefined;
  favouritesBackend.hangsReads = false;
  favouritesBackend.writeOutcome = "saves";
  favouritesBackend.holdsWrites = false;
  favouritesBackend.requests = [];
  releaseHeldWrites = undefined;
  heldWrites = Promise.resolve();
}

/** Holds every write from now on until `releaseWrites`. */
export function holdWrites(): void {
  favouritesBackend.holdsWrites = true;
  heldWrites = new Promise<void>((resolve) => {
    releaseHeldWrites = resolve;
  });
}

export function releaseWrites(): void {
  releaseHeldWrites?.();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const serverError = () =>
  jsonResponse({ code: "XX000", message: "database unavailable", details: null, hint: null }, 500);

const limitRefusal = () =>
  jsonResponse({ code: "KL004", message: "favourite limit", details: null, hint: null }, 400);

const CREATED_AT = "2026-11-03T09:00:00+00:00";

function idOf(request: Request, column: string): string | null {
  const filter = new URL(request.url).searchParams.get(column);

  return filter === null ? null : filter.replace(/^eq\./, "");
}

async function answerWrite(
  request: Request,
  table: "food_favourites" | "recipe_favourites",
): Promise<Response> {
  const isFood = table === "food_favourites";
  const column = isFood ? "food_id" : "recipe_id";
  const ids = isFood ? favouritesBackend.favouriteFoodIds : favouritesBackend.favouriteRecipeIds;
  const body: unknown = request.method === "POST" ? await request.clone().json() : null;
  const bodyId: unknown =
    typeof body === "object" && body !== null
      ? Object.entries(body).find(([key]) => key === column)?.[1]
      : undefined;
  const id = typeof bodyId === "string" ? bodyId : (idOf(request, column) ?? "");
  favouritesBackend.requests.push({ method: request.method, table, foodOrRecipeId: id });

  if (favouritesBackend.holdsWrites) {
    await heldWrites;
  }
  if (favouritesBackend.writeOutcome === "fails") {
    return serverError();
  }
  if (favouritesBackend.writeOutcome === "refusesLimit" && request.method === "POST") {
    return limitRefusal();
  }
  const others = ids.filter((existing) => existing !== id);
  const next = request.method === "POST" ? [id, ...others] : others;
  if (isFood) {
    favouritesBackend.favouriteFoodIds = next;
  } else {
    favouritesBackend.favouriteRecipeIds = next;
  }

  return new Response(null, { status: request.method === "POST" ? 201 : 204 });
}

function answerRead(table: "food_favourites" | "recipe_favourites"): Promise<Response> {
  favouritesBackend.requests.push({ method: "GET", table, foodOrRecipeId: null });
  if (favouritesBackend.hangsReads) {
    return new Promise<Response>(() => undefined);
  }
  if (favouritesBackend.failsReads || favouritesBackend.failsReadsOf === table) {
    return Promise.resolve(serverError());
  }
  if (table === "food_favourites") {
    return Promise.resolve(
      jsonResponse(
        favouritesBackend.favouriteFoodIds.flatMap((id) => {
          const food = favouritesBackend.foods.get(id);

          return food === undefined ? [] : [{ created_at: CREATED_AT, foods: food }];
        }),
      ),
    );
  }

  return Promise.resolve(
    jsonResponse(
      favouritesBackend.favouriteRecipeIds.flatMap((id) => {
        const recipe = favouritesBackend.recipes.get(id);

        return recipe === undefined ? [] : [{ created_at: CREATED_AT, recipes: recipe }];
      }),
    ),
  );
}

/**
 * Answers a request to the favourite tables, and returns undefined for any other request, so a screen's own
 * fake database can try this first.
 */
export function answerFavouriteRequest(request: Request): Promise<Response> | undefined {
  const { pathname } = new URL(request.url);
  const table = pathname.endsWith("/food_favourites")
    ? "food_favourites"
    : pathname.endsWith("/recipe_favourites")
      ? "recipe_favourites"
      : undefined;
  if (table === undefined) {
    return undefined;
  }

  return request.method === "GET" ? answerRead(table) : answerWrite(request, table);
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return (
    answerFavouriteRequest(new Request(input, init)) ??
    Promise.resolve(jsonResponse({ message: "unexpected request" }, 404))
  );
}

export const favouritesClient = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** Renders under the real api-client, whose network is the fake favourite tables above, and a toast provider. */
export function renderWithFavourites(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <KeyLowProvider client={favouritesClient} queryClient={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </KeyLowProvider>,
  );
}
