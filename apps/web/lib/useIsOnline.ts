import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => onlineManager.subscribe(onChange);
const getSnapshot = () => onlineManager.isOnline();
// The server render has no connection to ask about, and a page that is rendered there is online until told otherwise.
const getServerSnapshot = () => true;

/**
 * Whether the app can reach the server. It reads React Query's online manager, which follows the
 * browser's online and offline events, so the screens and the queries (which pause offline) always agree.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
