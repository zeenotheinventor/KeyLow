import { keys } from "@keylow/api-client";

import type { QueryClient } from "@tanstack/react-query";

/**
 * Drops the reads of the targets and of the programme from the cache after a save that changed them (the setup
 * estimate, Edit programme), so Targets and Programme read fresh and show their loading state until the new
 * figures land, never the old ones under "Targets saved". Dropping is not awaiting: the refresh the save starts is
 * not waited for, because a refetch pauses offline and the page must never hang on one. The screen that is leaving
 * keeps its own drawn figures, since a dropped read restarts empty.
 */
export function dropStaleTargetReads(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: keys.profiles.targets });
  queryClient.removeQueries({ queryKey: keys.program.all });
}
