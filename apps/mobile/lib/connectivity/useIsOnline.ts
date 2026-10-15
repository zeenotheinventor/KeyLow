import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);
const getSnapshot = () => onlineManager.isOnline();

/**
 * Whether the app can reach the server. It reads React Query's online manager, which `feedOnlineManager`
 * keeps up to date, so the screens and the queries (which pause offline) always agree.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}
