import { TRAIN_NO_ROUTINE } from "@keylow/core/copy";
import { View } from "react-native";

import { Button, Card, Text } from "../../ui";
import { TrainIconTile } from "../TrainIconTile";

import type { TrainNoRoutineProps } from "./types";

/**
 * The card for a person who has trained but has no active routine, as the no routine board draws it: a
 * calendar tile beside the title, a sentence, and the two ways forward side by side. A button is drawn only
 * when its handler is given, so none is a dead control.
 */
export function TrainNoRoutine({
  onCreateRoutine,
  onLogSession,
  isLogDisabled,
  isStarting = false,
}: TrainNoRoutineProps) {
  const hasActions = onCreateRoutine !== undefined || onLogSession !== undefined;

  return (
    <Card>
      <View className="gap-2">
        <View className="flex-row items-center gap-3">
          <TrainIconTile name="Calendar" />
          <Text className="min-w-0 flex-1" role="heading" variant="h2">
            {TRAIN_NO_ROUTINE.title}
          </Text>
        </View>
        <Text tone="secondary">{TRAIN_NO_ROUTINE.body}</Text>
        {hasActions ? (
          <View className="mt-2 flex-row gap-2">
            {onCreateRoutine === undefined ? null : (
              <Button className="flex-1" onPress={onCreateRoutine}>
                {TRAIN_NO_ROUTINE.createAction}
              </Button>
            )}
            {onLogSession === undefined ? null : (
              <Button
                className="flex-1"
                disabled={isLogDisabled}
                loading={isStarting}
                variant="secondary"
                onPress={onLogSession}
              >
                {TRAIN_NO_ROUTINE.logAction}
              </Button>
            )}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
