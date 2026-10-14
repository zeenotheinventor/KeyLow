import { iconSize, iconStroke } from "@keylow/tokens";

import { useTheme } from "../../../lib/theme";
import { toneColorName } from "../tone";
import { iconMap } from "./iconMap";

import type { IconProps } from "./types";

export function Icon({ name, size = "md", tone = "primary", label }: IconProps) {
  const { colors } = useTheme();
  const LucideIcon = iconMap[name];

  // Lucide takes its colour as a prop, which a class cannot reach, so it is read from the theme.
  const accessibility =
    label === undefined
      ? ({ "aria-hidden": true } as const)
      : ({ accessible: true, role: "img", "aria-label": label } as const);

  return (
    <LucideIcon
      color={colors[toneColorName[tone]]}
      size={iconSize[size]}
      strokeWidth={iconStroke}
      {...accessibility}
    />
  );
}
