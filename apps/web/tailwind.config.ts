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
      // The design system's kl-shimmer and kl-fade-in, which the tokens do not carry. A skeleton
      // bone sweeps its shine across at 1400 ms and fades in over the quick duration.
      keyframes: {
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        "skeleton-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        skeleton: "shimmer 1400ms linear infinite, skeleton-in 160ms ease both",
      },
    },
  },
};

export default config;
