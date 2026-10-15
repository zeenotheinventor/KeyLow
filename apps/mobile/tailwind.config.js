const { elevation, preset, themes, themeVariables } = require("@keylow/tokens");
const plugin = require("tailwindcss/plugin");

// The classes read `--kl-*` variables. The app's ThemeProvider sets them on its root view for the
// scheme in use, so a class follows the app's own preference. This `:root` set is only what a class
// resolves to outside a provider, and it is dark because dark is the default. It is not driven by
// the device scheme: "Match device" is resolved by the provider, from the native scheme that
// `userInterfaceStyle: "automatic"` in app.json lets follow the device.
//
// The skeleton's shine gradient is a proposed variable the ThemeProvider adds, which `@keylow/tokens`
// does not have. Its dark value is here too, and the ThemeProvider holds the same rule for both schemes.
const themeVariablesPlugin = plugin((api) => {
  api.addBase({
    ":root": {
      ...themeVariables("dark"),
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

// The dim over the camera outside the viewfinder's frame: the frame's own shadow, spread far enough to
// cover the preview, which the camera view's parent clips. Its colour is the `viewfinder-dim` token, the
// same in both themes, written with the spaces React Native's colour parser is given elsewhere. The value
// is a quoted string so it reaches React Native as one: unquoted, NativeWind splits the shorthand into a
// list of numbers that React Native does not read as a shadow.
const viewfinderDim = themes.dark["viewfinder-dim"].replaceAll(",", ", ");
const viewfinderDimPlugin = plugin((api) => {
  api.addUtilities({
    ".viewfinder-dim": { "-rn-box-shadow": `"0 0 0 999px ${viewfinderDim}"` },
  });
});

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./.rnstorybook/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset"), preset],
  corePlugins: { fontWeight: false, fontVariantNumeric: false },
  theme: {
    extend: {
      fontFamily: { sans: [geistWeights.normal.fontFamily] },
    },
  },
  plugins: [
    themeVariablesPlugin,
    geistWeightsPlugin,
    tabularNumbersPlugin,
    elevationPlugin,
    skeletonShinePlugin,
    viewfinderDimPlugin,
  ],
};
