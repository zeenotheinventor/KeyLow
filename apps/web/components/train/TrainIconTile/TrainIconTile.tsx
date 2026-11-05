import { iconStroke } from "@keylow/tokens";

import type { TrainIconTileProps } from "./types";

// The fill and the icon's colour of each tone, written out so Tailwind sees them. The check is a stroke, as
// the toast's icon is, because success is not a text colour in light mode (the source guard says so).
const toneClassNames = {
  accent: { fill: "bg-accent-muted", icon: "text-accent-ink" },
  success: { fill: "bg-success-muted", icon: "stroke-success" },
  raised: { fill: "bg-surface-raised", icon: "text-text-secondary" },
} as const;

/** The 36 px tile with an icon in it that the Train cards put before a line or a title, as the boards draw it. */
export function TrainIconTile({ icon: Icon, tone = "raised" }: TrainIconTileProps) {
  const { fill, icon } = toneClassNames[tone];
  return (
    <span className={`flex size-9 shrink-0 items-center justify-center rounded-small ${fill}`}>
      <Icon aria-hidden className={`size-5 ${icon}`} strokeWidth={iconStroke} />
    </span>
  );
}
