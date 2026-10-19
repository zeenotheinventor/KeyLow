import { SESSION_ACTIVE } from "@keylow/core/copy";
import { View } from "react-native";

import { SetRow, setColumnClassName } from "../SetRow";
import { Card, Text } from "../ui";

import type { ExerciseCardProps } from "./types";

// The headings of the number columns sit over the middle of their cells.
const columnHeadingClassName = "text-center";

/**
 * An exercise of the session as the `session · active` board draws it: its name and target line over a table
 * of its set rows. The column headings are hidden from a screen reader, since each row's check names its own
 * numbers. The board's More button waits for its own ticket. The card is a region named for the exercise, and
 * its rows are a list named Sets.
 */
export function ExerciseCard({ name, target, columns, rows }: ExerciseCardProps) {
  return (
    <Card aria-label={name} level="surface" padding={0} role="region">
      <View className="gap-0 pb-1 pt-2">
        <View className="min-h-10 justify-center px-3">
          <Text role="heading" variant="body-strong">
            {name}
          </Text>
          <Text tone="muted" variant="caption">
            {target}
          </Text>
        </View>
        <View aria-hidden className={`h-[18px] flex-row items-center ${setColumnClassName.row}`}>
          <Text className={setColumnClassName.mark} tone="muted" variant="caption">
            {columns.set}
          </Text>
          <Text className={setColumnClassName.previous} tone="muted" variant="caption">
            {columns.previous}
          </Text>
          <Text
            className={`${setColumnClassName.load} ${columnHeadingClassName}`}
            tone="muted"
            variant="caption"
          >
            {columns.load}
          </Text>
          <Text
            className={`${setColumnClassName.reps} ${columnHeadingClassName}`}
            tone="muted"
            variant="caption"
          >
            {columns.reps}
          </Text>
          <Text
            className={`${setColumnClassName.rir} ${columnHeadingClassName}`}
            tone="muted"
            variant="caption"
          >
            {columns.rir}
          </Text>
          <View className={setColumnClassName.check} />
        </View>
        <View aria-label={SESSION_ACTIVE.setsListName} role="list">
          {rows.map(({ key, state, setType, copy }) => (
            <SetRow copy={copy} key={key} setType={setType} state={state} />
          ))}
        </View>
      </View>
    </Card>
  );
}
