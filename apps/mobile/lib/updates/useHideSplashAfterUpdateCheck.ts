import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";

import { cancelSplashHoldCeiling } from "./holdSplashScreen";
import { startOnLatestUpdate } from "./startOnLatestUpdate";

// How long the splash screen waits for a reload to take the app away. A reload that has started ends this
// JavaScript within moments, so if it is still running after this, the reload did nothing.
export const reloadFailsafeMilliseconds = 3000;

/**
 * Hides the splash screen once the check for a newer update has settled, and says whether the update
 * screen is to be shown meanwhile. The root layout holds the splash screen first, which stops the router
 * hiding it.
 *
 * When there is no update, or the check fails, the splash screen is hidden at once. When an update is found
 * `isUpdateScreenShown` turns true and `progress` follows the download, from 0 to 1, until the update
 * ends. The splash screen stays up until the update screen calls `handleUpdateScreenLayout`, so there is
 * never a frame of the app or a blank between them. The update ends in a reload, which leaves the update
 * screen up so the user sees it carry on into the new bundle, or in a stall or a failure, which remove the
 * screen and carry on with the bundle the app has. If the reload does not restart the app, the screen goes
 * after a short failsafe too.
 */
export function useHideSplashAfterUpdateCheck() {
  const [isUpdateScreenShown, setIsUpdateScreenShown] = useState(false);
  const [progress, setProgress] = useState<number | undefined>();
  const isSplashScreenHidden = useRef(false);

  // The splash screen is hidden once, by whichever comes first: the update screen's layout or the end of the update.
  const hideSplashScreen = useCallback(() => {
    if (!isSplashScreenHidden.current) {
      isSplashScreenHidden.current = true;
      void SplashScreen.hideAsync();
    }
  }, []);

  useEffect(() => {
    let isGone = false;
    let failsafe: ReturnType<typeof setTimeout> | undefined;

    void startOnLatestUpdate({
      onUpdateFound: () => {
        if (!isGone) {
          cancelSplashHoldCeiling();
          setIsUpdateScreenShown(true);
        }
      },
      onProgress: (downloaded) => {
        if (!isGone) {
          setProgress(downloaded);
        }
      },
    }).then((outcome) => {
      if (outcome !== "reloading") {
        hideSplashScreen();
        if (!isGone) {
          setIsUpdateScreenShown(false);
        }
      } else if (!isGone) {
        failsafe = setTimeout(() => {
          setIsUpdateScreenShown(false);
          hideSplashScreen();
        }, reloadFailsafeMilliseconds);
      }
    });

    return () => {
      isGone = true;
      clearTimeout(failsafe);
    };
  }, [hideSplashScreen]);

  return { isUpdateScreenShown, progress, handleUpdateScreenLayout: hideSplashScreen };
}
