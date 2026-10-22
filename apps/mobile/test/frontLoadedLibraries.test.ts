// These native libraries ship in the main app's first build so a later milestone does not need a
// new APK to start using them (charts and health data in M5 and M7, reminders from expo-notifications, feature flag support later). No
// screen imports them yet. Importing each one here keeps the Jest setup honest: the day a screen
// does, its tests start from modules that load without native code. Skia is mocked for every test
// (test/support/skiaMock.ts), so its case only proves that the Victory import chain, which sits on
// top of it, loads.
describe("native libraries that ship before their milestones", () => {
  it.each([
    "@shopify/react-native-skia",
    "victory-native",
    "react-native-health-connect",
    "@kingstinct/react-native-healthkit",
    "expo-application",
    "expo-device",
    "expo-localization",
    "expo-notifications",
  ])("should import %s without its native module", (name) => {
    // A name held in a variable cannot be a static import, and Jest runs without ES module support.
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(name);
    }).not.toThrow();
  });
});
