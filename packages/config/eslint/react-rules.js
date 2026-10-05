import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * The React rules shared by the web and mobile configs. Not part of the package exports: consume
 * `eslint/react` or `eslint/react-native` instead.
 *
 * @type {import("eslint").Linter.Config[]}
 */
const reactRules = [
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat.recommended,
  {
    settings: { react: { version: "detect" } },
    rules: {
      // TypeScript props types replace runtime prop-types.
      "react/prop-types": "off",
    },
  },
];

export default reactRules;
