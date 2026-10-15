import { iconSize, iconStroke } from "@keylow/tokens";

import { useTheme } from "../../../lib/theme";
import { toneColorName } from "../tone";
import { iconMap } from "./iconMap";

import type { IconProps, IconTone } from "./types";
import type { Theme } from "../../../lib/theme";

function toneColor(tone: IconTone, theme: Theme): string {
  // The ink, accent, status and calories glyphs are the colours themselves, where every other tone is a text or fill tone.
  // `accent-ink` is the design's token: lime in dark, and the primary text colour in light where lime is
  // too faint for a thin glyph.
  return tone === "accent-ink" ||
    tone === "accent" ||
    tone === "success" ||
    tone === "warning" ||
    tone === "danger" ||
    tone === "calories"
    ? theme.colors[tone]
    : theme.colors[toneColorName[tone]];
}

export function Icon({
  name,
  size = "md",
  tone = "primary",
  strokeWidth = iconStroke,
  label,
}: IconProps) {
  const theme = useTheme();
  const LucideIcon = iconMap[name];

  // Lucide takes its colour as a prop, which a class cannot reach, so it is read from the theme.
  const color = toneColor(tone, theme);
  const accessibility =
    label === undefined
      ? ({ "aria-hidden": true } as const)
      : ({ accessible: true, role: "img", "aria-label": label } as const);

  return (
    <LucideIcon
      color={color}
      size={typeof size === "number" ? size : iconSize[size]}
      strokeWidth={strokeWidth}
      {...accessibility}
    />
  );
}
