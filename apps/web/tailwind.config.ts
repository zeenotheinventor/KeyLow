import path from "node:path";

import { fontFamily, preset, themePlugin } from "@keylow/tokens";

import { matchDeviceTheme } from "./lib/theme/matchDeviceTheme";
import { loadAnimations } from "./tailwind/loadAnimations";

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [preset],
  plugins: [themePlugin, matchDeviceTheme],
  theme: {
    extend: {
      // next/font names the loaded Geist behind --font-geist, so it goes first. The design's own
      // stack follows as the fallback.
      fontFamily: {
        sans: ["var(--font-geist)", ...fontFamily.sans],
      },
      // One file per animation in ./tailwind/animations, so a new one is a new file.
      ...loadAnimations(path.join(__dirname, "tailwind", "animations")),
    },
  },
};

export default config;
