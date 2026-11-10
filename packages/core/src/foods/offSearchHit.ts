import { normaliseOffCandidate } from "./off";

import type { OffCandidate } from "../schemas/off";

/**
 * The fields Search-a-licious indexes that a candidate reads. `serving_size`, `serving_quantity`,
 * `packaging_tags` and `nutrition_data_per` are not in its index at all, so none is asked for.
 */
export const OFF_SEARCH_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "brands",
  "quantity",
  "countries_tags",
  "categories_tags",
  "nutriments",
] as const;

const queryCharacters = /[+!(){}[\]^"~*?:\\/<>=]/g;
// A minus that starts a word excludes it, and one standing alone breaks the query. Inside a word it is fine.
const leadingMinuses = /^-+/;
const queryOperatorWords = new Set(["and", "or", "not"]);

/**
 * Makes typed words safe to put in a Search-a-licious query, which reads `q` as a query language.
 * Quotes, colons, tildes and brackets either find nothing or switch the filter off, so the query
 * characters (including `<`, `>` and `=`) become spaces, a minus at the start of a word is dropped, and the standalone words `and`, `or` and `not` are removed. Apostrophes,
 * `&` and `%` stay. The result is lower case with single spaces, and is empty when nothing is left.
 * The server-side store keys on this string, so `(Oat  Milk` and `oat milk` give the same one.
 */
export function normaliseOffSearchTerms(terms: string): string {
  return terms
    .normalize("NFKC")
    .toLowerCase()
    .replace(queryCharacters, " ")
    .split(/\s+/)
    .map((word) => word.replace(leadingMinuses, ""))
    .filter((word) => word !== "" && !queryOperatorWords.has(word))
    .join(" ");
}

/**
 * The `q` value for a search. Only products sold in the United Kingdom (decision Q11), and only
 * products with nutriments, so a page is filled with rows that have values rather than cosmetics.
 */
export function buildOffSearchQuery(cleanTerms: string): string {
  return `${cleanTerms} countries_tags:"en:united-kingdom" nutriments:*`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

// Search-a-licious sends `brands` as an array, where the product payload schema reads a
// comma-separated string, and would otherwise read an array as no brand.
function withBrandsAsText(hit: Record<string, unknown>): Record<string, unknown> {
  const { brands } = hit;
  return Array.isArray(brands)
    ? { ...hit, brands: brands.filter((brand) => typeof brand === "string").join(",") }
    : hit;
}

/**
 * A search hit as a candidate, or null when it cannot be one: no name, no usable code, or no energy
 * once macros and kilojoules are tried. A hit carries no serving, so its default portion comes from the
 * pack size and the categories alone, and the stored product may open on a serving the hit could not show.
 */
export function normaliseOffSearchHit(hit: unknown): OffCandidate | null {
  if (!isRecord(hit)) {
    return null;
  }
  const candidate = normaliseOffCandidate(withBrandsAsText(hit));
  return candidate === null || candidate.kcal === null ? null : candidate;
}
