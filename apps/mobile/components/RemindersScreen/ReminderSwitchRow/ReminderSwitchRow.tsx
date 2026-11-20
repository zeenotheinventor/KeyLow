import { View } from "react-native";

import { Badge, Switch, Text, useGroupedRowPosition } from "../../ui";

import type { ReminderSwitchRowProps } from "./types";

/**
 * A row of a grouped list for one reminder: its name (with a pill such as "New" when it has one) and a helper line, with the kit's switch at the end,
 * named for the reminder. The row has the list row's height, padding and hairline between rows. No board
 * draws it, so it is composed of the kit's parts and is not a shared component.
 */
export function ReminderSwitchRow({
  title,
  helper,
  badge,
  isOn,
  disabled = false,
  onValueChange,
}: ReminderSwitchRowProps) {
  const { isFirst } = useGroupedRowPosition();

  return (
    <View
      className={`min-h-[56px] flex-row items-center gap-3 px-3 py-2 ${isFirst ? "" : "border-t border-border"}`}
    >
      <View className="min-w-0 flex-1 gap-[2px]">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text variant="body-strong">{title}</Text>
          {badge === undefined ? null : <Badge tone="accent">{badge}</Badge>}
        </View>
        <Text tone="muted" variant="caption">
          {helper}
        </Text>
      </View>
      <Switch disabled={disabled} isOn={isOn} label={title} onValueChange={onValueChange} />
    </View>
  );
}
