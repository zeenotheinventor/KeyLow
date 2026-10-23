import * as SplashScreen from "expo-splash-screen";

// The longest the splash screen is held from launch while the app has not found an update. It is more than
// the check's own limit plus the reload failsafe, so those finish first, with a margin for reading the
// stored theme before the check starts. It is the last resort if the screens never get ready to be shown.
// Once an update is found it stops counting (see `cancelSplashHoldCeiling`), because a download can run
// far longer and the update screen hands the splash screen over itself.
export const splashHoldCeilingMilliseconds = 10_000;

let ceilingTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Holds the splash screen while the app checks for a newer update, which the router would otherwise hide
 * as soon as it is ready. Call it as the root layout loads, before the splash screen could be hidden. The
 * hold always ends by the ceiling, so a failure anywhere cannot leave the app behind the splash screen.
 */
export function holdSplashScreen() {
  void SplashScreen.preventAutoHideAsync();
  ceilingTimer = setTimeout(() => {
    void SplashScreen.hideAsync();
  }, splashHoldCeilingMilliseconds);
}

/**
 * Ends the ceiling. It is called when an update is found: the update screen is about to take over from
 * the splash screen and lets it go once it has been laid out, so a ceiling that fired first would show the
 * app, or a blank, for a moment. The update ends in a stall, a failure or a reload, and each of those lets
 * the splash screen go too, so nothing is left holding it.
 */
export function cancelSplashHoldCeiling() {
  clearTimeout(ceilingTimer);
  ceilingTimer = undefined;
}
