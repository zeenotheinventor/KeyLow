import { htmlOf, pagePathOf, recipePages } from "./recipeImportPages.ts";
import { redTeamPages } from "./redTeamPages.ts";

/**
 * Every page the eval page server serves, by path: the pages of the recipe import set (KEY-701) and of the
 * red-team set (KEY-702). The server in `src/pageServer.ts` serves the lot.
 */
export const fixturePages: ReadonlyMap<string, string> = new Map(
  [...recipePages, ...redTeamPages].map((page) => [pagePathOf(page), htmlOf(page)]),
);
