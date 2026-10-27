import { useSegments } from "expo-router";
import { useEffect } from "react";
import { AppState, Keyboard } from "react-native";

import { recordAppState, recordKeyboard, recordRoute } from "./trail";

/**
 * Leaves a trail for a report to show: the screens moved between, the app coming forward or going away,
 * and the keyboard coming and going. The screen's route is a pattern with its parameters unfilled, so it
 * holds no id. Sentry's own breadcrumbs for navigation and app state are not on in this app, and the
 * ones it has are dropped by the scrubbing unless they are on its list.
 */
export function useSentryTrail(): void {
  const route = `/${useSegments().join("/")}`;

  useEffect(() => {
    recordRoute(route);
  }, [route]);

  useEffect(() => {
    const subscriptions = [
      AppState.addEventListener("change", recordAppState),
      Keyboard.addListener("keyboardDidShow", ({ endCoordinates }) => {
        recordKeyboard("show", endCoordinates);
      }),
      Keyboard.addListener("keyboardDidHide", ({ endCoordinates }) => {
        recordKeyboard("hide", endCoordinates);
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => {
        subscription.remove();
      });
    };
  }, []);
}
