import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { getHealthProvider } from "../../lib/health";

import type { BodyCompositionAccess } from "../../lib/health";

const nothingGranted: BodyCompositionAccess = { bodyFat: false, leanMass: false };

/**
 * Which of body fat and lean mass Ki-Lo may read from Health Connect, read from the provider's granted
 * list. It is null until the provider has answered, and for good where the device has no provider, so the
 * Weight screen draws nothing in either case. It reads again when the app returns to the foreground and
 * when the screen is focused again, as after the permission flow closes. It never prompts, and a provider
 * that fails reads as nothing granted.
 */
export function useBodyCompositionAccess(): BodyCompositionAccess | null {
  // One provider for the life of the screen: asking for one makes a new object each time.
  const [provider] = useState(getHealthProvider);
  const [access, setAccess] = useState<BodyCompositionAccess | null>(null);

  const check = useCallback(() => {
    if (provider === null) {
      return;
    }
    void provider
      .bodyCompositionAccess()
      .catch(() => nothingGranted)
      .then(setAccess);
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

  return access;
}
