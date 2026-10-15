import { onlineManager } from "@tanstack/react-query";
import { AppState } from "react-native";

import { probeConnection } from "./probeConnection";
import { watchConnection } from "./watchConnection";

/**
 * Makes React Query's online manager follow whether the server can be reached. React Native has no
 * `online` and `offline` events, so without this the manager is always online. The manager starts the
 * watch when the first query subscribes and stops it when the last one goes. With no server address
 * (a test) nothing is watched, and the app counts as online.
 */
export function feedOnlineManager(): void {
  // Metro inlines the variable only where it is read by its full name.
  const serverUrl: unknown = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (typeof serverUrl !== "string" || serverUrl === "") {
    return;
  }

  onlineManager.setEventListener((setOnline) =>
    watchConnection({
      probe: () => probeConnection(serverUrl),
      onChange: setOnline,
      appState: AppState,
    }),
  );
}
