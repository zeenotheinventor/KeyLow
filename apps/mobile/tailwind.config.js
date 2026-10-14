const { controlHeight, preset, themeVariables, touchTarget } = require("@keylow/tokens");
const plugin = require("tailwindcss/plugin");

// The classes read `--kl-*` variables. The app's ThemeProvider sets them on its root view for the
// scheme in use, so a class follows the app's own preference. This `:root` set is only what a class
// resolves to outside a provider, and it is dark because dark is the default. It is not driven by
// the device scheme: "Match device" is resolved by the provider, from the native scheme that
// `userInterfaceStyle: "automatic"` in app.json lets follow the device.
const themeVariablesPlugin = plugin((api) => {
  api.addBase({ ":root": themeVariables("dark") });
});

// React Native cannot select a weight of a custom font family, so each weight is its own embedded
// file and its own family name. The names are the files' PostScript names, which is what iOS looks
// up, and the file names under assets/fonts, which is what Android looks up. Each weight class
// sets the family and states the weight, so a heavier parent text does not leak its weight in.
// Only the three weights the design uses are embedded, so no other weight class exists.
// The type-scale classes (`text-h1` and the rest) set a fontWeight but no family, so they must be
// paired with `font-normal`, `font-medium` or `font-semibold`. The Text primitive (KEY-93) does so.
const geistWeights = {
  normal: { fontFamily: "Geist-Regular", fontWeight: "400" },
  medium: { fontFamily: "Geist-Medium", fontWeight: "500" },
  semibold: { fontFamily: "Geist-SemiBold", fontWeight: "600" },
};

const geistWeightsPlugin = plugin((api) => {
  api.addUtilities(
    Object.fromEntries(
      Object.entries(geistWeights).map(([name, declarations]) => [`.font-${name}`, declarations]),
    ),
  );
});

// The design's control heights and touch target are not in the Tailwind preset, which only carries the
// spacing scale. They are the sizes a button, a field or a row is built to, so they get names here,
// read from the tokens package, for `h-control-md`, `w-touch-target` and the like.
const controlSizes = {
  "control-sm": `${controlHeight.sm}px`,
  "control-md": `${controlHeight.md}px`,
  "control-lg": `${controlHeight.lg}px`,
  "touch-target": `${touchTarget}px`,
};

// NativeWind 4.2.7 drops `font-variant-numeric`, so Tailwind's own `tabular-nums` compiles to nothing.
// `-rn-` is react-native-css-interop's escape hatch for a native style prop it has no CSS mapping for:
// it strips the prefix and camel-cases the rest, so this becomes the `fontVariant` style. The class
// keeps Tailwind's name, and the core plugin that would also emit it is switched off below.
const tabularNumbersPlugin = plugin((api) => {
  api.addUtilities({ ".tabular-nums": { "-rn-font-variant": "tabular-nums" } });
});

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./.rnstorybook/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset"), preset],
  corePlugins: { fontWeight: false, fontVariantNumeric: false },
  theme: {
    extend: {
      fontFamily: { sans: [geistWeights.normal.fontFamily] },
      width: controlSizes,
      height: controlSizes,
      minWidth: controlSizes,
      minHeight: controlSizes,
    },
  },
  plugins: [themeVariablesPlugin, geistWeightsPlugin, tabularNumbersPlugin],
};
