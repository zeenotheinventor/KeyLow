import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { startOnLatestUpdate } from "./startOnLatestUpdate";

// How long the splash screen waits for a reload to take the app away. A reload that has started ends this
// JavaScript within moments, so if it is still running after this, the reload did nothing.
export const reloadFailsafeMilliseconds = 3000;

/**
 * Hides the splash screen once the check for a newer update has settled. The root layout holds the splash
 * screen first, which stops the router hiding it. When the app is about to reload onto an update the
 * splash screen stays up, so the user sees it carry on into the new bundle. If the reload does not
 * restart the app, the splash screen is hidden after a short failsafe and the app carries on.
 */
export function useHideSplashAfterUpdateCheck() {
  useEffect(() => {
    let isGone = false;
    let failsafe: ReturnType<typeof setTimeout> | undefined;

    void startOnLatestUpdate().then((outcome) => {
      if (outcome !== "reloading") {
        void SplashScreen.hideAsync();
      } else if (!isGone) {
        failsafe = setTimeout(() => {
          void SplashScreen.hideAsync();
        }, reloadFailsafeMilliseconds);
      }
    });

    return () => {
      isGone = true;
      clearTimeout(failsafe);
    };
  }, []);
}
