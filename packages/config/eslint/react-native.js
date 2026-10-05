import expo from "eslint-plugin-expo";

import base from "./base.js";
import reactRules from "./react-rules.js";

/** @type {import("eslint").Linter.Config[]} */
const reactNative = [
  ...base,
  ...reactRules,
  {
    plugins: { expo },
    languageOptions: {
      globals: { __DEV__: "readonly" },
    },
    rules: {
      "expo/no-dynamic-env-var": "error",
      "expo/no-env-var-destructuring": "error",
      "expo/use-dom-exports": "error",
      // Metro bundles static assets through require(), so allow it for asset file types only.
      "@typescript-eslint/no-require-imports": [
        "error",
        { allow: ["\\.(png|jpe?g|gif|webp|svg|ttf|otf|mp3|mp4|json)$"] },
      ],
    },
  },
];

export default reactNative;
