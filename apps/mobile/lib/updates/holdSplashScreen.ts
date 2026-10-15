import * as SplashScreen from "expo-splash-screen";

// The longest the splash screen is held from launch, on any path. It is more than the check's own limit
// plus the reload failsafe, so those finish first, with a margin for reading the stored theme before the
// check starts. It is the last resort if the screens never get ready to be shown.
export const splashHoldCeilingMilliseconds = 10_000;

/**
 * Holds the splash screen while the app checks for a newer update, which the router would otherwise hide
 * as soon as it is ready. Call it as the root layout loads, before the splash screen could be hidden. The
 * hold always ends by the ceiling, so a failure anywhere cannot leave the app behind the splash screen.
 */
export function holdSplashScreen() {
  void SplashScreen.preventAutoHideAsync();
  setTimeout(() => {
    void SplashScreen.hideAsync();
  }, splashHoldCeilingMilliseconds);
}
