import { SvgWidget } from "react-native-android-widget";

import type { IconProps, WidgetIconName } from "./types";

// The shapes the boards draw, on a 24 point grid. Play is solid, the rest are strokes.
const SHAPES: Readonly<Record<WidgetIconName, string>> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  scan: '<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M9 9v6M12 9v6M15 9v6"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  weight: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 10a4 4 0 0 1 6 0l-2 3"/>',
  recipe:
    '<path d="M6 13.9A4 4 0 0 1 7 6a5 5 0 0 1 10 0 4 4 0 0 1 1 7.9V20H6z"/><path d="M6 17h12"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  training: '<path d="M6.5 6.5h11M6.5 17.5h11M3 9v6M21 9v6M6.5 6.5v11M17.5 6.5v11"/>',
  offline:
    '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2-1.6M12 20h.01"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
};

export function Icon({ name, colour, size, strokeWidth = 2 }: IconProps) {
  const paint =
    name === "play"
      ? `fill="${colour}"`
      : `fill="none" stroke="${colour}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${paint}>${SHAPES[name]}</svg>`;

  return <SvgWidget svg={svg} style={{ width: size, height: size }} />;
}
