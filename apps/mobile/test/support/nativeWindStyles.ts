import { cssToReactNativeRuntimeOptions } from "nativewind/dist/metro/common";
import postcss from "postcss";
import { registerCSS, setupAllComponents } from "react-native-css-interop/test";
import tailwindcss from "tailwindcss";

import type { Config } from "tailwindcss";

// Typed by hand because the app has no Node type definitions.
const { readFileSync } = jest.requireActual<{
  readFileSync: (path: string, encoding: "utf8") => string;
}>("node:fs");

/**
 * Compiles the app's own `tailwind.config.js` and `global.css` for the class names given, the way
 * Metro does for Android, so a test sees the styles NativeWind would resolve on a device. It reads
 * `global.css` from the working directory, which is the app folder when Jest runs from there.
 */
export async function compileAppStyles(classNames: string): Promise<string> {
  // The NativeWind preset picks its native or web flavour from this when Tailwind reads the config.
  process.env.NATIVEWIND_OS = "android";
  const config = jest.requireActual<Config>("../../tailwind.config.js");
  const input = readFileSync("global.css", "utf8");

  const { css } = await postcss([
    tailwindcss({ ...config, content: [{ raw: classNames }] }),
  ]).process(input, { from: undefined });

  return css;
}

/** Hands the compiled styles to NativeWind's runtime. Call it in `beforeEach`, because the runtime resets between tests. */
export function registerAppStyles(css: string): void {
  registerCSS(css, cssToReactNativeRuntimeOptions);
  setupAllComponents();
}
