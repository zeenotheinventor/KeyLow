/**
 * Makes `%`, `_` and the escape character itself match as themselves in an `ilike` pattern. PostgREST
 * also reads every `*` in the value as `%` and has no way to escape one, so a `*` cannot be matched
 * literally. It becomes `_`, which finds a name with a star in that place (and, as a known limit, any
 * other single character there) and never lets the star stand for a run of characters.
 */
export const escapeLikePattern = (text: string): string =>
  text.replace(/[\\%_]/g, (character) => `\\${character}`).replaceAll("*", "_");
