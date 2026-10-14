const unsupportedIntlApis = ["ListFormat", "RelativeTimeFormat", "Segmenter", "DisplayNames"];

/**
 * Hermes, the JavaScript engine of the mobile app, ships without these `Intl` APIs. Node, jsdom
 * and browsers have them, so a use passes every test and CI and then crashes the app at launch.
 *
 * @type {import("eslint").Linter.Config[]}
 */
const hermes = [
  {
    rules: {
      "no-restricted-properties": [
        "error",
        ...unsupportedIntlApis.map((property) => ({
          object: "Intl",
          property,
          message: `Hermes, the mobile JavaScript engine, has no Intl.${property}. Write the formatting by hand.`,
        })),
      ],
    },
  },
];

export default hermes;
