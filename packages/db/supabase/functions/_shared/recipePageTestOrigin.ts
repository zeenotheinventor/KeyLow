// A seam for the recipe import evals (KEY-701), and nothing else. The import tool refuses every private
// address, and an eval page server runs on the host of the local stack, so no page of it could ever be
// read. This lets one reserved name, `recipes.keylow.test`, stand for that server, so the eval can put an
// ordinary link in its message: the name resolves to a made-up public address, which the guard accepts, and
// the request for it goes to the server instead. The guard in `recipePage.ts` is not touched and judges
// every other address as before, including a redirect out of the test host.
//
// It is on only when both gates hold, and both are read from this function's own environment:
// - RECIPE_PAGE_TEST_ORIGIN is set to the address of the page server (`.env.test` sets it, and no project
//   secret ever should), and
// - SUPABASE_URL names a local stack: the host is exactly `kong` (what `supabase functions serve` sets),
//   `localhost` or `127.0.0.1`. A hosted project's address ends in `.supabase.co`, so a stray secret in
//   production still does nothing.
// Nothing here reads a request, a header, a tool input or a model output. The only input that is not the
// environment is the address `fetchRecipePage` is about to fetch, and that can only be matched against the
// one reserved name or passed on unchanged.

import type { RecipePageDependencies } from "./recipePage.ts";

export const RECIPE_PAGE_TEST_HOST = "recipes.keylow.test";

// It only has to pass the guard as a public address for the reserved name. It is a routable address (it was
// example.com's), not a reserved one, and nothing ever connects to it: `fetchPage` rewrites the request to the
// test origin before a socket opens. No reserved address would do instead, because the guard refuses every
// documentation range on purpose (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 2001:db8::/32, 3fff::/20).
const ADDRESS_ANSWERED_FOR_TEST_HOST = "93.184.216.34";
const LOCAL_STACK_HOSTS: ReadonlySet<string> = new Set(["kong", "localhost", "127.0.0.1"]);

export type RecipePageTestOverrides = Partial<
  Pick<RecipePageDependencies, "fetchPage" | "resolveDns">
>;

type RealDependencies = Pick<RecipePageDependencies, "fetchPage" | "resolveDns">;

const realDependencies: RealDependencies = {
  fetchPage: (url, init) => fetch(url, init),
  resolveDns: (hostname, recordType, options) => Deno.resolveDns(hostname, recordType, options),
};

function parseUrl(text: string | undefined): URL | null {
  if (text === undefined) {
    return null;
  }
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

function isLocalStack(supabaseUrl: string | undefined): boolean {
  const url = parseUrl(supabaseUrl);
  return url !== null && LOCAL_STACK_HOSTS.has(url.hostname);
}

function testOriginOf(text: string | undefined): URL | null {
  const url = parseUrl(text);
  return url !== null && (url.protocol === "http:" || url.protocol === "https:") ? url : null;
}

/**
 * The dependencies to pass to `fetchRecipePage` besides its own. Empty, which changes nothing, unless both
 * gates hold. `real` is what every other address falls back to.
 */
export function recipePageTestOverrides(
  readEnv: (name: string) => string | undefined,
  real: RealDependencies = realDependencies,
): RecipePageTestOverrides {
  const origin = testOriginOf(readEnv("RECIPE_PAGE_TEST_ORIGIN"));
  if (origin === null || !isLocalStack(readEnv("SUPABASE_URL"))) {
    return {};
  }
  return {
    resolveDns: (hostname, recordType, options) =>
      hostname === RECIPE_PAGE_TEST_HOST
        ? Promise.resolve(recordType === "A" ? [ADDRESS_ANSWERED_FOR_TEST_HOST] : [])
        : real.resolveDns(hostname, recordType, options),
    fetchPage: (url, init) => {
      const address = parseUrl(url);
      return address !== null && address.hostname === RECIPE_PAGE_TEST_HOST
        ? real.fetchPage(`${origin.origin}${address.pathname}${address.search}`, init)
        : real.fetchPage(url, init);
    },
  };
}
