import base from "@keylow/config/eslint/base";
import hermes from "@keylow/config/eslint/hermes";

// The leading slash is deliberate so the patterns match package names only, not relative paths. The scoped
// names have none, because a scope already starts the name.
const platformPackagePatterns = [
  "/react",
  "/react-*",
  "/react-native*",
  "/expo*",
  "/next*",
  "@react-three/*",
  "@expo/*",
  "@react-native/*",
  "@react-native-*/*",
];

export default [
  ...base,
  ...hermes,
  {
    // The web and the mobile renderers both load this, so shipped code may use neither Node built-ins nor a platform package.
    files: ["src/**/*.ts"],
    rules: {
      "import-x/no-nodejs-modules": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: platformPackagePatterns,
              message:
                "@keylow/body-3d is renderer neutral and must not depend on a platform package.",
            },
          ],
        },
      ],
    },
  },
];
