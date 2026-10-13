export type HighlightSegment = {
  text: string;
  /** True for the parts of the name that match the query, which the row writes in bold. */
  matched: boolean;
};

const MIN_QUERY_WORD_LENGTH = 2;

const isLetterOrDigit = (character: string): boolean =>
  character.toLowerCase() !== character.toUpperCase() || (character >= "0" && character <= "9");

const startsWord = (name: string, index: number): boolean =>
  isLetterOrDigit(name.charAt(index)) && (index === 0 || !isLetterOrDigit(name.charAt(index - 1)));

/** The length of the longest query word that the name continues with at `index`, or 0. */
const matchLengthAt = (name: string, index: number, queryWords: readonly string[]): number =>
  queryWords.reduce(
    (longest, word) =>
      word.length > longest && name.slice(index, index + word.length).toLowerCase() === word
        ? word.length
        : longest,
    0,
  );

/**
 * Splits a food name into segments, marking the parts that match the query. Each query word
 * matches the start of a word in the name, without regard to case, and single letter query words
 * are ignored. No regular expression is built from the query, so any text is safe to pass.
 *
 * This is presentational best effort. It does not claim to mirror the ranking in `search_foods`.
 * The segments always join back to the name, and neighbouring segments differ in `matched`.
 */
export const highlightMatch = (name: string, query: string): HighlightSegment[] => {
  const queryWords = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= MIN_QUERY_WORD_LENGTH);

  const segments: HighlightSegment[] = [];
  const append = (text: string, matched: boolean) => {
    const last = segments.at(-1);
    if (last !== undefined && last.matched === matched) {
      last.text += text;
    } else {
      segments.push({ text, matched });
    }
  };

  let index = 0;
  while (index < name.length) {
    const matchLength = startsWord(name, index) ? matchLengthAt(name, index, queryWords) : 0;
    if (matchLength > 0) {
      append(name.slice(index, index + matchLength), true);
      index += matchLength;
    } else {
      append(name.charAt(index), false);
      index += 1;
    }
  }
  return segments;
};
