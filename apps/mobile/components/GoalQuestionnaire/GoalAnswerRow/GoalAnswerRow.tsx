import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { Icon, PressableSurface, Text, useGroupedRowPosition } from "../../ui";

import type { GoalAnswerRowProps } from "./types";

/**
 * A row of the Goal screen as `goals · edit` draws it: the question as a caption in a 92 point column, the
 * answer as body text that fills the row and wraps, and a chevron. It is 56 points tall at least, with the
 * hairline above every row after the first, and one button named for the whole row. The kit's `ListRow` puts
 * the answer in a slot that cannot wrap, so a long Equipment answer would not fit it. It is used only here.
 */
export function GoalAnswerRow({ label, value, name, onPress }: GoalAnswerRowProps) {
  const { isFirst } = useGroupedRowPosition();

  return (
    <PressableSurface
      className={`min-h-[56px] flex-row items-center gap-3 px-3 py-2 ${isFirst ? "" : "border-t border-border"}`}
      label={name}
      pressScale={rowPressScale}
      onPress={onPress}
    >
      <View className="w-[92px] shrink-0">
        <Text tone="secondary" variant="caption">
          {label}
        </Text>
      </View>
      <View className="flex-1">
        <Text>{value}</Text>
      </View>
      <Icon name="ChevronRight" size="sm" tone="muted" />
    </PressableSurface>
  );
}
