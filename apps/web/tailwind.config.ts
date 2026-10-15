import {
  fontFamily,
  preset,
  themePlugin,
  transitionDuration,
  transitionTimingFunction,
} from "@keylow/tokens";

import { matchDeviceTheme } from "./lib/theme/matchDeviceTheme";

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
      // The design system's kl-shimmer and kl-fade-in, which the tokens do not carry. A skeleton
      // bone sweeps its shine across at 1400 ms and fades in over the quick duration.
      keyframes: {
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        "skeleton-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        // The design system's kl-wipe-in, kl-slash and kl-punch at full distance. Reduced motion
        // is a `motion-reduce:animate-none` on each use, not a variable.
        "wipe-in": {
          from: { opacity: "0", clipPath: "polygon(0 0, 0 0, -30% 100%, -30% 100%)" },
          "1%": { opacity: "1" },
          to: { opacity: "1", clipPath: "polygon(0 0, 130% 0, 100% 100%, -30% 100%)" },
        },
        slash: {
          from: { opacity: "0.9", transform: "translateX(-140%) skewX(-22deg)" },
          to: { opacity: "0", transform: "translateX(240%) skewX(-22deg)" },
        },
        punch: {
          from: { opacity: "0", transform: "scale(1.14)" },
          "55%": { opacity: "1", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        skeleton: "shimmer 1400ms linear infinite, skeleton-in 160ms ease both",
        "wipe-in": `wipe-in ${transitionDuration.standard} ${transitionTimingFunction.whip} both`,
        slash: `slash ${transitionDuration.flourish} ${transitionTimingFunction.exit} both`,
        punch: `punch ${transitionDuration.flourish} ${transitionTimingFunction.enter} both`,
      },
    },
  },
};

export default config;
