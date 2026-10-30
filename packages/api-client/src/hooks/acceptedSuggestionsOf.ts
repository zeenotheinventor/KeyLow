import type { AcceptedSuggestionsRead } from "../repos/acceptedSuggestions";
import type { AcceptedSuggestion } from "@keylow/core/training";
import type { UseQueryResult } from "@tanstack/react-query";

const NONE: readonly AcceptedSuggestion[] = [];

/**
 * The accepted suggestions the projection counts as planned, or undefined while they are not known yet.
 * The rows are known once they are read, none included. A read that is paused for want of a connection
 * and has nothing cached counts as none, so a cache saved before accepted suggestions were kept still
 * shows its numbers offline, and they follow the suggestions once the connection is back. An online
 * first load is not known yet, and neither is a failed read, so those stay pending and in error. A row
 * that did not parse is already left out by the read.
 */
export function acceptedSuggestionsOf(
  accepted: UseQueryResult<AcceptedSuggestionsRead>,
): readonly AcceptedSuggestion[] | undefined {
  if (accepted.data !== undefined) {
    return accepted.data.suggestions;
  }
  return accepted.fetchStatus === "paused" ? NONE : undefined;
}
