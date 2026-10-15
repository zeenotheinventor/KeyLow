import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

/**
 * Whether the app can reach the server. It reads React Query's online manager, which `feedOnlineManager`
 * keeps up to date, so the screens and the queries (which pause offline) always agree.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
