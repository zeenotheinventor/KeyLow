import { HISTORY_SESSION_DETAIL } from "@keylow/core/copy";
import { View } from "react-native";

import { SetRow } from "../../SetRow";
import { Card, Text } from "../../ui";

import type { ReadOnlyExerciseCardProps } from "./types";

/**
 * An exercise of a logged session, as the `history · session-detail` board draws it: its name with a note
 * beside it, over the sets it holds. There are no column headings, since each row reads as a sentence. The
 * card is a region named for the exercise, and its rows are a list named Sets.
 */
export function ReadOnlyExerciseCard({ name, note, rows }: ReadOnlyExerciseCardProps) {
  return (
    <Card aria-label={name} level="surface" padding={0} role="region">
      <View className="pb-1 pt-2">
        <View className="flex-row items-baseline justify-between gap-2 px-3 pb-1">
          <Text className="min-w-0 shrink" role="heading" variant="body-strong">
            {name}
          </Text>
          {note === null ? null : (
            <Text className="shrink-0" tone="muted" variant="caption">
              {note}
            </Text>
          )}
        </View>
        <View aria-label={HISTORY_SESSION_DETAIL.setsListName} role="list">
          {rows.map(({ key, ...row }) => (
            <SetRow key={key} variant="readOnly" {...row} />
          ))}
        </View>
      </View>
    </Card>
  );
}
