import { View } from "react-native";

import { Icon, Text } from "../../ui";

import type { StatTilesProps } from "./types";
import type { IconName, IconTone } from "../../ui";

type StatTileProps = {
  icon: IconName;
  iconTone: IconTone;
  value: string;
  caption: string;
};

// One tile reads as one phrase to a screen reader, such as "12 day streak".
function StatTile({ icon, iconTone, value, caption }: StatTileProps) {
  return (
    <View
      accessible
      aria-label={`${value} ${caption}`}
      className="flex-1 gap-1 rounded-medium border border-border bg-surface p-3"
    >
      <Icon name={icon} tone={iconTone} />
      <Text variant="numeral-small">{value}</Text>
      <Text tone="muted" variant="caption">
        {caption}
      </Text>
    </View>
  );
}

/** The streak, the freezes held and the badge count, three tiles under the level card, as board 1 draws them. */
export function StatTiles({ tiles }: StatTilesProps) {
  return (
    <View className="flex-row gap-2">
      <StatTile
        caption={tiles.streak.caption}
        icon="Flame"
        iconTone="warning-ink"
        value={tiles.streak.value}
      />
      <StatTile
        caption={tiles.freezes.caption}
        icon="Snowflake"
        iconTone="protein"
        value={tiles.freezes.value}
      />
      <StatTile
        caption={tiles.badges.caption}
        icon="Trophy"
        iconTone="accent-ink"
        value={tiles.badges.value}
      />
    </View>
  );
}
