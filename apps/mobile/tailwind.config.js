const {
  controlHeight,
  elevation,
  preset,
  themes,
  themeVariables,
  touchTarget,
} = require("@keylow/tokens");
const plugin = require("tailwindcss/plugin");

// The classes read `--kl-*` variables. The app's ThemeProvider sets them on its root view for the
// scheme in use, so a class follows the app's own preference. This `:root` set is only what a class
// resolves to outside a provider, and it is dark because dark is the default. It is not driven by
// the device scheme: "Match device" is resolved by the provider, from the native scheme that
// `userInterfaceStyle: "automatic"` in app.json lets follow the device.
//
// Two of the variables are the proposed tokens the ThemeProvider adds (`--warning-ink` and the skeleton's
// shine gradient), which `@keylow/tokens` does not have yet. Their dark values are here too, and the
// ThemeProvider holds the same two rules for both schemes.
const themeVariablesPlugin = plugin((api) => {
  api.addBase({
    ":root": {
      ...themeVariables("dark"),
      "--kl-warning-ink": themes.dark.warning,
      "--kl-skeleton-shine-gradient": `linear-gradient(100deg, transparent, ${themes.dark["skeleton-shine"]}, transparent)`,
    },
  });
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

// NativeWind turns `shadow-*` into the iOS shadow props and an Android elevation, and drops a theme
// shadow whose value is a CSS variable, so `shadow-card` compiles to nothing. React Native draws a
// `boxShadow` string itself, including the inset highlight the design's elevation has, and `-rn-` hands
// it over. The variable is the scheme's own (`--kl-elevation-*`, set by the ThemeProvider), so a card
// follows dark and light.
const elevationPlugin = plugin((api) => {
  api.addUtilities(
    Object.fromEntries(
      Object.keys(elevation.dark).map((name) => [
        `.elevation-${name}`,
        { "-rn-box-shadow": `var(--kl-elevation-${name})` },
      ]),
    ),
  );
});

// The shine that sweeps over a skeleton bone. React Native draws a gradient from `experimental_backgroundImage`,
// which `-rn-` hands over, and the ThemeProvider holds the whole gradient in one variable because a class
// cannot build one from a colour variable. The design's value is soft at both edges, so the band fades.
const skeletonShinePlugin = plugin((api) => {
  api.addUtilities({
    ".skeleton-shine": {
      "-rn-experimental_background-image": "var(--kl-skeleton-shine-gradient)",
    },
  });
});

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./.rnstorybook/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset"), preset],
  corePlugins: { fontWeight: false, fontVariantNumeric: false },
  theme: {
    extend: {
      // `--kl-warning-ink` is set by the ThemeProvider. It is a whole colour, so it takes no opacity modifier.
      colors: { "warning-ink": "var(--kl-warning-ink)" },
      fontFamily: { sans: [geistWeights.normal.fontFamily] },
      width: controlSizes,
      height: controlSizes,
      minWidth: controlSizes,
      minHeight: controlSizes,
    },
  },
  plugins: [
    themeVariablesPlugin,
    geistWeightsPlugin,
    tabularNumbersPlugin,
    elevationPlugin,
    skeletonShinePlugin,
  ],
};
