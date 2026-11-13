const MIN_QUERY_WORD_LENGTH = 3;

/** The lower case words (letters and digits) of a text, in order. */
export const wordsOf = (text: string): string[] =>
  text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

// The endings that make two forms of a word one: plurals, "-ed" and "-ing", a final "e" and "y". It follows
// the English stemmer the `search_foods` RPC uses closely enough for food names, and it is only ever used
// to compare two words, so a stem need not be a word.
export function stemOf(word: string): string {
  let stem = word;
  if (stem.endsWith("sses")) {
    stem = stem.slice(0, -2);
  } else if (stem.endsWith("ies") && stem.length > 4) {
    stem = `${stem.slice(0, -3)}i`;
  } else if (stem.endsWith("oes")) {
    stem = stem.slice(0, -2);
  } else if (stem.endsWith("s") && !/(ss|us|is)$/.test(stem)) {
    stem = stem.slice(0, -1);
  }
  const ending = ["ing", "ed"].find(
    (suffix) =>
      stem.endsWith(suffix) &&
      stem.length - suffix.length >= MIN_QUERY_WORD_LENGTH &&
      /[aeiouy]/.test(stem.slice(0, -suffix.length)),
  );
  if (ending !== undefined) {
    stem = stem.slice(0, -ending.length);
  }
  if (stem.length > MIN_QUERY_WORD_LENGTH && stem.endsWith("e")) {
    stem = stem.slice(0, -1);
  }
  return stem.endsWith("y") ? `${stem.slice(0, -1)}i` : stem;
}

/**
 * Whether the catalogue answered a search well enough that Open Food Facts need not be asked: some food
 * name holds every word of the query that has 3 or more letters, compared by stem, so "tomatoes" finds
 * "Tomato, raw". Shorter words are ignored. A query with none of 3 or more letters is matched by any name,
 * and no names at all is never a match.
 */
export function hasStrongFoodMatch(query: string, names: readonly string[]): boolean {
  const queryStems = wordsOf(query)
    .filter((word) => word.length >= MIN_QUERY_WORD_LENGTH)
    .map(stemOf);
  return names.some((name) => {
    const nameStems = new Set(wordsOf(name).map(stemOf));
    return queryStems.every((stem) => nameStems.has(stem));
  });
}
