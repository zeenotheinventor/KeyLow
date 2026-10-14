import { themes } from "@keylow/tokens";

import type { ColorName, ThemeScheme } from "@keylow/tokens";

/** The `rgba(r, g, b, 1)` string NativeWind resolves a solid colour class to, read from the token. */
export function resolvedColor(scheme: ThemeScheme, name: ColorName): string {
  const [red, green, blue] = [1, 3, 5].map((start) =>
    parseInt(themes[scheme][name].slice(start, start + 2), 16),
  );
  return `rgba(${red}, ${green}, ${blue}, 1)`;
}
