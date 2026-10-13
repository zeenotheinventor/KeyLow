import { GLOBALS_UPDATED } from "storybook/internal/core-events";

import { defaultThemeScheme, themeGlobalKey, themeSchemes } from "./constants";

import type { ThemeChannel } from "./types";
import type { ThemeScheme } from "@keylow/tokens";

// The panel sits in a bottom sheet that unmounts when it is dismissed, so the scheme is kept here, outside it.
let currentScheme: ThemeScheme = defaultThemeScheme;
const listeners = new Set<() => void>();

function findScheme(value: unknown): ThemeScheme | undefined {
  return themeSchemes.find((option) => option.scheme === value)?.scheme;
}

export function getThemeScheme(): ThemeScheme {
  return currentScheme;
}

export function subscribeToThemeScheme(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** Keeps the store in step with the Storybook theme global, from whichever place it is changed. */
export function followThemeGlobal(channel: ThemeChannel): void {
  channel.on(GLOBALS_UPDATED, ({ globals }) => {
    const scheme = findScheme(globals[themeGlobalKey]);
    if (scheme !== undefined && scheme !== currentScheme) {
      currentScheme = scheme;
      listeners.forEach((listener) => {
        listener();
      });
    }
  });
}
