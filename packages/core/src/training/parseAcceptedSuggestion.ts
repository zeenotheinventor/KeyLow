import { z } from "zod";

import { acceptedSuggestionSchema } from "../schemas/training";

import type { StoredAcceptedSuggestion } from "../schemas/training";

/**
 * A stored row that does not parse is reported by its id, or null when it has none the id schema accepts,
 * and the paths of its fields, such as `exercises.0.target_sets`. Never a value: a suggestion is health
 * data, so nothing the row holds reaches a log or an error report from here.
 */
export type ParsedAcceptedSuggestion =
  | { ok: true; suggestion: StoredAcceptedSuggestion }
  | { ok: false; id: string | null; fieldPaths: string[] };

const rowIdSchema = z.guid();

const idOf = (row: unknown): string | null => {
  if (typeof row !== "object" || row === null || !("id" in row)) {
    return null;
  }
  const result = rowIdSchema.safeParse(row.id);
  return result.success ? result.data : null;
};

/**
 * Reads the columns of a stored `accepted_suggestions` row that the projection needs. It never throws.
 * The field paths come in the order the schema found them, each once, and the path of a break at the row
 * itself (a row that is not an object) is left out.
 */
export const parseAcceptedSuggestion = (row: unknown): ParsedAcceptedSuggestion => {
  const result = acceptedSuggestionSchema.safeParse(row);
  if (result.success) {
    return { ok: true, suggestion: result.data };
  }
  const fieldPaths = result.error.issues
    .map((issue) => issue.path.join("."))
    .filter((path) => path !== "");
  return { ok: false, id: idOf(row), fieldPaths: [...new Set(fieldPaths)] };
};
