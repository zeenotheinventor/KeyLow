import { View } from "react-native";

import { Switch, Text, useGroupedRowPosition } from "../../ui";

import type { ReminderSwitchRowProps } from "./types";

/**
 * A row of a grouped list for one reminder: its name and a helper line, with the kit's switch at the end,
 * named for the reminder. The row has the list row's height, padding and hairline between rows. No board
 * draws it, so it is composed of the kit's parts and is not a shared component.
 */
export function ReminderSwitchRow({
  title,
  helper,
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
        <Text variant="body-strong">{title}</Text>
        <Text tone="muted" variant="caption">
          {helper}
        </Text>
      </View>
      <Switch disabled={disabled} isOn={isOn} label={title} onValueChange={onValueChange} />
    </View>
  );
}
