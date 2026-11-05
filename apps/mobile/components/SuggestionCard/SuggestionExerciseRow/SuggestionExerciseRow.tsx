import { View } from "react-native";

import { Text } from "../../ui";

import type { SuggestionExerciseRowProps } from "./types";

/**
 * One exercise of the suggested session, as the `suggestion · detail` board draws it: the name and its
 * target on one line, and under them where it came from. An exercise added to the plan sits on the accent
 * wash and says why in the primary tone, and one kept from the plan says so quietly. `ListRow` has no line
 * of this kind, so it is built here.
 */
export function SuggestionExerciseRow({ row, hasDivider }: SuggestionExerciseRowProps) {
  return (
    <View
      accessible
      className={`gap-1 p-3 ${hasDivider ? "border-t border-border" : ""} ${row.added ? "bg-accent-muted" : ""}`}
      role="listitem"
    >
      <View className="flex-row items-baseline justify-between gap-2">
        <Text className="min-w-0 flex-1" variant="body-strong">
          {row.name}
        </Text>
        <Text tone="secondary" variant="caption">
          {row.target}
        </Text>
      </View>
      <Text tone={row.added ? "primary" : "muted"} variant="caption">
        {row.why}
      </Text>
    </View>
  );
}
