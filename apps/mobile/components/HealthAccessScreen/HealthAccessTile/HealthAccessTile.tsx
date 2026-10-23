import { iconStroke } from "@keylow/tokens";
import { View } from "react-native";

import { SpinningGlyph } from "../../SpinningGlyph";
import { Icon } from "../../ui";

import type { HealthAccessTileProps } from "./types";
import type { IconName, IconTone } from "../../ui";
import type { HealthAccessStep } from "../types";

// The 64 point tile above the heading: its fill and the glyph it carries, one look for each state. The classes
// are written out so Tailwind sees them. The tile never shrinks, so the scrolling area above the buttons
// cannot squash it.
const looks: Record<
  HealthAccessStep,
  { fillClassName: string; icon: IconName; iconTone: IconTone }
> = {
  explain: { fillClassName: "bg-accent-muted", icon: "Heart", iconTone: "accent-ink" },
  install: { fillClassName: "bg-surface-raised", icon: "CircleAlert", iconTone: "secondary" },
  connecting: { fillClassName: "bg-accent-muted", icon: "LoaderCircle", iconTone: "accent-ink" },
  denied: { fillClassName: "bg-surface-raised", icon: "CircleAlert", iconTone: "secondary" },
  "import-error": { fillClassName: "bg-danger-muted", icon: "CircleAlert", iconTone: "danger" },
  connected: { fillClassName: "bg-success-muted", icon: "Check", iconTone: "success-ink" },
  "explain-body-composition": {
    fillClassName: "bg-accent-muted",
    icon: "Heart",
    iconTone: "accent-ink",
  },
  "denied-body-composition": {
    fillClassName: "bg-surface-raised",
    icon: "CircleAlert",
    iconTone: "secondary",
  },
  "connected-partial": {
    fillClassName: "bg-success-muted",
    icon: "Check",
    iconTone: "success-ink",
  },
};

// The board draws the tick and the spinner at a stroke of 2, and the other glyphs at the design's 1.75.
const heavyStrokeSteps: readonly HealthAccessStep[] = [
  "connecting",
  "connected",
  "connected-partial",
];

export function HealthAccessTile({ step }: HealthAccessTileProps) {
  const look = looks[step];
  const glyph = (
    <Icon
      name={look.icon}
      size={30}
      strokeWidth={heavyStrokeSteps.includes(step) ? 2 : iconStroke}
      tone={look.iconTone}
    />
  );

  return (
    <View
      className={`h-[64px] w-[64px] shrink-0 items-center justify-center rounded-large ${look.fillClassName}`}
    >
      {step === "connecting" ? <SpinningGlyph>{glyph}</SpinningGlyph> : glyph}
    </View>
  );
}
