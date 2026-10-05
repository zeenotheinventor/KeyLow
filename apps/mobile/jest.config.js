module.exports = {
  preset: "jest-expo",
  // Workspace packages ship TypeScript source, so Jest must transform them like app code.
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@keylow/.*)",
  ],
};
