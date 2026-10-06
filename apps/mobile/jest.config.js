module.exports = {
  preset: "jest-expo",
  // The first test in a suite pays for the cold module load and first render, which took over the
  // 5 second default on a CI runner. Every suite gets the headroom from here.
  testTimeout: 20000,
  // Workspace packages ship TypeScript source, so Jest must transform them like app code.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@keylow/.*)",
  ],
};
