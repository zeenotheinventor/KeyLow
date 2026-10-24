import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelSplashHoldCeiling } from "./holdSplashScreen";
import { startOnLatestUpdate } from "./startOnLatestUpdate";

// How long the splash screen waits for a reload to take the app away. A reload that has started ends this
// JavaScript within moments, so if it is still running after this, the reload did nothing.
export const reloadFailsafeMilliseconds = 3000;

/**
 * Hides the splash screen once the check for a newer update has settled, and says when it has gone. The
 * root layout holds the splash screen first, which stops the router hiding it.
 *
 * When there is no update, or the check fails, the splash screen is hidden at once. When an update is found
 * the splash screen stays up for the whole download, so the person sees the splash screen and nothing else,
 * and the ceiling that would otherwise let it go is cancelled. The update ends in a reload, which leaves the
 * splash screen up so the new bundle starts behind it, or in a stall or a failure, which hide it and carry
 * on with the bundle the app has. If the reload does not restart the app, the splash screen goes after a
 * short failsafe too.
 *
 * The result is true once the splash screen has been hidden, which is when the app is in view.
 */
export function useHideSplashAfterUpdateCheck(): boolean {
  const [isSplashScreenGone, setIsSplashScreenGone] = useState(false);
  const isSplashScreenHidden = useRef(false);

  // The splash screen is hidden once, by whichever ends the update first.
  const hideSplashScreen = useCallback(() => {
    if (!isSplashScreenHidden.current) {
      isSplashScreenHidden.current = true;
      void SplashScreen.hideAsync().finally(() => {
        setIsSplashScreenGone(true);
      });
    }
  }, []);

  useEffect(() => {
    let isGone = false;
    let failsafe: ReturnType<typeof setTimeout> | undefined;

    void startOnLatestUpdate({
      onUpdateFound: () => {
        if (!isGone) {
          cancelSplashHoldCeiling();
        }
      },
    }).then((outcome) => {
      if (outcome !== "reloading") {
        hideSplashScreen();
      } else if (!isGone) {
        failsafe = setTimeout(hideSplashScreen, reloadFailsafeMilliseconds);
      }
    });

    return () => {
      isGone = true;
      clearTimeout(failsafe);
    };
  }, [hideSplashScreen]);

  return isSplashScreenGone;
}
