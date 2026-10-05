import base from "@keylow/config/eslint/base";

// The leading slash is deliberate so the patterns match package names only, not relative paths.
const platformPackagePatterns = [
  "/react",
  "/react-*",
  "/react-native*",
  "/expo*",
  "/next*",
  "/@supabase/*",
];

export default [
  ...base,
  {
    // Core runs in React Native and Deno, so shipped code may use neither Node built-ins nor platform packages.
    files: ["src/**/*.ts"],
    rules: {
      "import-x/no-nodejs-modules": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: platformPackagePatterns,
              message: "@keylow/core is pure logic and must not depend on a platform package.",
            },
          ],
        },
      ],
    },
  },
];
