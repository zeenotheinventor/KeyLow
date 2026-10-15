// The real `holdSplashScreen` starts a ten second timer that no test waits for, and it would keep every
// test file that loads the root layout from exiting cleanly. This keeps the hold and drops the timer. The
// test of the real thing takes it back with `jest.unmock`. The splash screen module is read when the hold
// is made, so a test's own mock of it is the one called.
jest.mock("../../lib/updates/holdSplashScreen", () => ({
  ...jest.requireActual<typeof import("../../lib/updates/holdSplashScreen")>(
    "../../lib/updates/holdSplashScreen",
  ),
  holdSplashScreen: () => {
    void jest
      .requireMock<typeof import("expo-splash-screen")>("expo-splash-screen")
      .preventAutoHideAsync();
  },
}));
