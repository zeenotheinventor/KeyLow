import { fontFamily, preset, themePlugin } from "@keylow/tokens";

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [preset],
  plugins: [themePlugin],
  theme: {
    extend: {
      // next/font names the loaded Geist behind --font-geist, so it goes first. The design's own
      // stack follows as the fallback.
      fontFamily: {
        sans: ["var(--font-geist)", ...fontFamily.sans],
      },
    },
  },
};

export default config;
