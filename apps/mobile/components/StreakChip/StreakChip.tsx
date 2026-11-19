import { describeStreakChip } from "@keylow/core/copy";
import { touchTarget } from "@keylow/tokens";
import { View } from "react-native";

import { Icon, PressableSurface, Text } from "../ui";

import type { StreakChipProps } from "./types";
import type { IconName, IconTone } from "../ui";

const chipHeight = 36;

// A chip drawn smaller than a touch target reaches out to it above and below. The reach is invisible.
const hitSlopVertical = (touchTarget - chipHeight) / 2;

// The classes are written out so Tailwind sees them. The board draws the chip with the raised surface and
// the strong border, and a status chip swaps both for the status colour and its muted fill.
const looks = {
  active: {
    className: "border-border-strong bg-surface-raised",
    icon: "Flame",
    iconTone: "warning-ink",
  },
  at_risk: {
    className: "border-warning bg-warning-muted",
    icon: "Flame",
    iconTone: "warning-ink",
  },
  freeze_used: {
    className: "border-protein bg-protein-muted",
    icon: "Snowflake",
    iconTone: "protein",
  },
  none: {
    className: "border-border-strong bg-surface-raised",
    icon: "Flame",
    iconTone: "muted",
  },
} satisfies Record<
  StreakChipProps["state"],
  { className: string; icon: IconName; iconTone: IconTone }
>;

/**
 * The Dashboard's streak chip, in the board's four states: the number when the streak is kept, with
 * "Complete today" when it is at risk and "Freeze used" when a freeze kept it, and "Start a streak" when
 * there is none. It opens the streak calendar. The words carry the state, so the colour is never the only signal.
 */
export function StreakChip({ state, current, onPress }: StreakChipProps) {
  const look = looks[state];
  const { text, accessibleName } = describeStreakChip(state, current);

  return (
    <View className="self-center">
      <PressableSurface
        className={`min-h-[36px] flex-row items-center gap-[6px] rounded-pill border px-3 ${look.className}`}
        hitSlop={{ top: hitSlopVertical, bottom: hitSlopVertical }}
        label={accessibleName}
        onPress={onPress}
      >
        <Icon name={look.icon} size={18} tone={look.iconTone} />
        <Text variant="label-small">{text}</Text>
      </PressableSurface>
    </View>
  );
}
