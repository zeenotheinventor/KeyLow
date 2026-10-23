import { describeSessionBar } from "@keylow/core/copy";
import { sessionClock } from "@keylow/core/training";
import { View } from "react-native";

import { useNow } from "../../lib/useNow";
import { Icon, PressableSurface, Text } from "../ui";

import type { SessionBarProps } from "./types";

/**
 * The bar above the tab bar while a session runs: an accent dot, the day's name, the clock with the sets
 * and a chevron up, all one control that opens the session. It reads the time itself and moves on every
 * second, so the tick redraws this bar and nothing else. Its accessible name carries whole minutes, so it
 * changes once a minute and a screen reader is not read every second.
 */
export function SessionBar({
  dayName,
  startedAt,
  setsLogged,
  setsPlanned,
  onPress,
}: SessionBarProps) {
  const now = useNow(1000);
  const copy = describeSessionBar({
    dayName,
    clockSeconds: sessionClock({ started_at: startedAt, ended_at: null }, now.toISOString()),
    setsLogged,
    setsPlanned,
  });

  return (
    <PressableSurface
      className="h-control-lg flex-row items-center gap-3 border-t border-border bg-surface-sheet px-4"
      label={copy.accessibleName}
      onPress={onPress}
    >
      <View aria-hidden className="h-2 w-2 rounded-full bg-accent" />
      <Text className="flex-1" numberOfLines={1} variant="body-strong">
        {copy.name}
      </Text>
      <Text tone="secondary" variant="caption">
        {copy.detail}
      </Text>
      <Icon name="ChevronUp" size={18} tone="muted" />
    </PressableSurface>
  );
}
