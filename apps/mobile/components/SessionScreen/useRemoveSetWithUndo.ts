import { useRemoveSetWithUndo as useSharedRemoveSetWithUndo } from "@keylow/api-client";

import { useSetNotices } from "./useSetNotices";

import type { RemoveSetRequest } from "./types";

/**
 * Removes a logged set and offers the Undo toast, "Set removed: Romanian deadlift, set 3", which restores it.
 * The rules are `@keylow/api-client`'s, shared with the web. The toast is the phone's. Resolves to whether
 * the set was removed.
 */
export function useRemoveSetWithUndo(): (request: RemoveSetRequest) => Promise<boolean> {
  return useSharedRemoveSetWithUndo(useSetNotices());
}
