import { useChangeSetType as useSharedChangeSetType } from "@keylow/api-client";

import { useSetNotices } from "./useSetNotices";

/**
 * Changes the type of a logged set. The rules are `@keylow/api-client`'s, shared with the web. The failure
 * toast is the phone's.
 */
export function useChangeSetType(): ReturnType<typeof useSharedChangeSetType> {
  return useSharedChangeSetType(useSetNotices());
}
