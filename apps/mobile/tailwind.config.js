const { preset, themeVariables } = require("@keylow/tokens");
const plugin = require("tailwindcss/plugin");

// The classes read `--kl-*` variables. The app's ThemeProvider sets them on its root view for the
// scheme in use, so a class follows the app's own preference. This `:root` set is only what a class
// resolves to outside a provider, and it is dark because dark is the default. It is not driven by
// the device scheme, because on a dev client the native scheme is pinned by `userInterfaceStyle`
// in app.json and never leaves light.
const themeVariablesPlugin = plugin((api) => {
  api.addBase({ ":root": themeVariables("dark") });
});

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset"), preset],
  plugins: [themeVariablesPlugin],
};
