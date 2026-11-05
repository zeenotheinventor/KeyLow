import { htmlOf, pagePathOf, recipePages } from "./recipeImportPages.ts";

/**
 * Every page the eval page server serves, by path. KEY-702's page cases add theirs here with one more
 * spread, and the server in `src/pageServer.ts` serves the lot.
 */
export const fixturePages: ReadonlyMap<string, string> = new Map(
  recipePages.map((page) => [pagePathOf(page), htmlOf(page)]),
);
