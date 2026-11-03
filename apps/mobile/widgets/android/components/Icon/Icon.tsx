import { SvgWidget } from "react-native-android-widget";

import type { IconProps, WidgetIconName } from "./types";

// The strokes the boards draw, on a 24 point grid.
const PATHS: Readonly<Record<WidgetIconName, string>> = {
  chevron: "M9 18l6-6-6-6",
  offline:
    "M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2-1.6M12 20h.01",
};

export function Icon({ name, colour, size }: IconProps) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[name]}"/></svg>`;

  return <SvgWidget svg={svg} style={{ width: size, height: size }} />;
}
