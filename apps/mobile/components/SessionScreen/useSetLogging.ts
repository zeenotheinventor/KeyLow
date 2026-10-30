import { useSetLogging as useSharedSetLogging } from "@keylow/api-client";

import { useSetNotices } from "./useSetNotices";

import type { PendingSets, SessionScreenView, SetLogging } from "./types";

/**
 * What the checks of the session screen do. The rules are `@keylow/api-client`'s, shared with the web. The
 * toast that a failure or a removal shows is the phone's.
 */
export function useSetLogging(view: SessionScreenView, pending: PendingSets): SetLogging {
  return useSharedSetLogging(view, pending, useSetNotices());
}
