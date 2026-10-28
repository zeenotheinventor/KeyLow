import { describeExerciseMusclesButton, SESSION_ACTIVE } from "@keylow/core/copy";
import { Pressable, View } from "react-native";

import { SetRow, setColumnClassName } from "../SetRow";
import { Button, Card, IconButton, Text } from "../ui";
import { ReadOnlyExerciseCard } from "./ReadOnlyExerciseCard";

import type { ActiveExerciseCardProps, ExerciseCardProps } from "./types";

// The headings of the number columns sit over the middle of their cells.
const columnHeadingClassName = "text-center";

/**
 * An exercise of the session as the `session · active` board draws it: its name and target line over a table
 * of its set rows. The column headings are hidden from a screen reader, since each row's check names its own
 * numbers. The header has the body icon button that opens the muscles the exercise works (and so does the
 * name) when the card is given what it does. The board's More button waits for its own ticket. The card is a
 * region named for the exercise, and its rows are a list named Sets, with Add set under them when the card is
 * given what it does. With `variant="readOnly"` it is an exercise of a logged session instead
 * (`ReadOnlyExerciseCard`).
 */
export function ExerciseCard(props: ExerciseCardProps) {
  if (props.variant === "readOnly") {
    return <ReadOnlyExerciseCard {...props} />;
  }
  return <ActiveExerciseCard {...props} />;
}

function ActiveExerciseCard({
  name,
  target,
  columns,
  rows,
  onAddSet,
  onShowMuscles,
}: ActiveExerciseCardProps) {
  const titles = (
    <>
      <Text role="heading" variant="body-strong">
        {name}
      </Text>
      <Text tone="muted" variant="caption">
        {target}
      </Text>
    </>
  );

  return (
    <Card aria-label={name} level="surface" padding={0} role="region">
      <View className="gap-0 pb-1 pt-2">
        <View
          className={`min-h-10 flex-row items-center gap-2 pl-3 ${onShowMuscles === undefined ? "pr-3" : "pr-1"}`}
        >
          <View className="min-w-0 flex-1 justify-center self-stretch">
            {onShowMuscles === undefined ? (
              titles
            ) : (
              // The press area is the whole column, the header's full height beside the icon button, which is
              // what reaches 44 points. The button names the same action for a screen reader, so it is no stop.
              <Pressable
                accessible={false}
                className="flex-1 justify-center"
                onPress={onShowMuscles}
              >
                {titles}
              </Pressable>
            )}
          </View>
          {onShowMuscles === undefined ? null : (
            <IconButton
              icon="PersonStanding"
              label={describeExerciseMusclesButton(name)}
              variant="ghost"
              onPress={onShowMuscles}
            />
          )}
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
          {rows.map(({ key, state, setType, copy, edit, typeEdit, onCheck }) => (
            <SetRow
              copy={copy}
              edit={edit}
              key={key}
              setType={setType}
              state={state}
              typeEdit={typeEdit}
              onCheck={onCheck}
            />
          ))}
        </View>
        {onAddSet === undefined ? null : (
          <Button
            className="ml-2 self-start"
            icon="Plus"
            size="sm"
            variant="ghost"
            onPress={onAddSet}
          >
            {SESSION_ACTIVE.addSetAction}
          </Button>
        )}
      </View>
    </Card>
  );
}
