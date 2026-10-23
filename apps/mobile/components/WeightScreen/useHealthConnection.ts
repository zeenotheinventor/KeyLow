import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { getHealthProvider } from "../../lib/health";
import { readHealthConnection } from "../HealthAccessScreen";

/**
 * `unavailable` is a device with no Health Connect: no provider, or one that is unsupported. `not-connected`
 * is one where Health Connect is, or can be installed, and permission is not held.
 */
export type HealthConnection = "checking" | "unavailable" | "not-connected" | "connected";

/**
 * Whether the Weight screen's weigh-ins can come from Health Connect, read from the provider and not from
 * the import: the screen offers the permission flow while it is `not-connected`. It reads again when the
 * app returns to the foreground and when the screen is focused again, as after the permission flow closes.
 * It asks for nothing, so a screen can call it freely.
 */
export function useHealthConnection(): HealthConnection {
  // One provider for the life of the screen: asking for one makes a new object each time.
  const [provider] = useState(getHealthProvider);
  const [connection, setConnection] = useState<HealthConnection>(
    provider === null ? "unavailable" : "checking",
  );

  const check = useCallback(() => {
    if (provider === null) {
      return;
    }
    void readHealthConnection(provider).then(({ availability, hasPermission }) => {
      if (availability === "unsupported") {
        setConnection("unavailable");
      } else {
        setConnection(
          availability === "available" && hasPermission ? "connected" : "not-connected",
        );
      }
    });
  }, [provider]);

  useFocusEffect(check);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        check();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [check]);

  return connection;
}
