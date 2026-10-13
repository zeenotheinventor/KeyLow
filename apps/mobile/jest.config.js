module.exports = {
  preset: "jest-expo",
  // A fixed place, under the ignored node_modules, so CI can keep it between runs.
  cacheDirectory: "<rootDir>/node_modules/.cache/jest",
  // Reads the React Native components before the first test, so that test no longer pays for loading
  // them on a cold cache.
  setupFilesAfterEnv: [
    "<rootDir>/test/support/warmReactNative.ts",
    "<rootDir>/test/support/expoHapticsMock.ts",
  ],
  // Headroom for a busy CI runner, where the same work takes several times as long.
  testTimeout: 20000,
  // lucide-react-native names its ES module build for the react-native condition, which Jest does not
  // transform. Node's own resolution picks the CommonJS build, which needs no transform.
  moduleNameMapper: { "^lucide-react-native$": require.resolve("lucide-react-native") },
  // Workspace packages ship TypeScript source, so Jest must transform them like app code.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@keylow/.*)",
    // Already plain CommonJS, so Babel would only slow the cold start. These are the biggest files the
    // first render loads: the React Native renderer and the web streams polyfill from Expo.
    "node_modules/react-native/Libraries/Renderer/implementations/",
    "node_modules/expo/virtual/streams\\.js$",
  ],
};
