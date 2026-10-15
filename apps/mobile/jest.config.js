const { execFileSync } = require("node:child_process");
const path = require("node:path");

// The kit barrel (components/ui/index.ts) and the story index (.rnstorybook/storybook.requires.ts) are
// generated and not committed. Turbo writes them before a test run, and this does the same for Jest run
// on its own, so a pull that added a component does not leave a stale barrel behind.
execFileSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--no-warnings",
    path.join(__dirname, "..", "..", "tools", "generate-lists", "src", "run.ts"),
  ],
  { stdio: "inherit" },
);

module.exports = {
  preset: "jest-expo",
  // A fixed place, under the ignored node_modules, so CI can keep it between runs.
  cacheDirectory: "<rootDir>/node_modules/.cache/jest",
  // Reads the React Native components before the first test, so that test no longer pays for loading
  // them on a cold cache.
  setupFilesAfterEnv: [
    "<rootDir>/test/support/asyncWaitDefault.ts",
    "<rootDir>/test/support/warmReactNative.ts",
    "<rootDir>/test/support/expoHapticsMock.ts",
    "<rootDir>/test/support/reanimatedWorkletsMock.ts",
    "<rootDir>/test/support/nitroModulesMock.ts",
    "<rootDir>/test/support/skiaMock.ts",
    "<rootDir>/test/support/holdSplashScreenMock.ts",
  ],
  // Locally a run uses half the cores, so several runs at once do not bury the machine. CI keeps the default.
  ...(process.env.CI ? {} : { maxWorkers: "50%" }),
  // Headroom for a busy CI runner, where the same work takes several times as long.
  testTimeout: 20000,
  // lucide-react-native names its ES module build for the react-native condition, which Jest does not
  // transform. Node's own resolution picks the CommonJS build, which needs no transform.
  moduleNameMapper: { "^lucide-react-native$": require.resolve("lucide-react-native") },
  // Workspace packages ship TypeScript source, so Jest must transform them like app code. Storybook
  // ships ES modules only, so it is transformed too. So do Victory and its d3 packages. Skia is
  // mocked for every test, and is listed for a test that takes the real one (see skiaMock.ts).
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@keylow/.*|storybook|@storybook/.*|standard-navigation|@shopify/react-native-skia|victory-native|d3-[^/]*|internmap)",
    // Already plain CommonJS, so Babel would only slow the cold start. These are the biggest files the
    // first render loads: the React Native renderer and the web streams polyfill from Expo.
    "node_modules/react-native/Libraries/Renderer/implementations/",
    "node_modules/expo/virtual/streams\\.js$",
  ],
};
