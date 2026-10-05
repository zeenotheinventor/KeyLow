import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

import base from "./base.js";
import reactRules from "./react-rules.js";

/** @type {import("eslint").Linter.Config[]} */
const react = [
  ...base,
  ...reactRules,
  jsxA11y.flatConfigs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
    },
  },
];

export default react;
