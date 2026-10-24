import reactNative from "@keylow/config/eslint/react-native";

export default [
  ...reactNative,
  {
    // Metro, Tailwind, Babel, Jest and the EAS build hook load these files as CommonJS, so they must use require().
    files: ["*.config.js", "scripts/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  { ignores: [".expo/", "node_modules/", "dist/", ".rnstorybook/storybook.requires.ts"] },
];
