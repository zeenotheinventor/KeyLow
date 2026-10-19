import { TRAIN_FIRST_TIME } from "@keylow/core/copy";
import { View } from "react-native";

import { BodyFigure, Button, Text } from "../../ui";
import { TrainIconTile } from "../TrainIconTile";

import type { TrainFirstTimeProps } from "./types";
import type { IconName } from "../../ui";

// The three lines of `TRAIN_FIRST_TIME.points`, each with its icon.
const points = [
  { icon: "Clock", text: TRAIN_FIRST_TIME.points[0] },
  { icon: "Flame", text: TRAIN_FIRST_TIME.points[1] },
  { icon: "Target", text: TRAIN_FIRST_TIME.points[2] },
] as const satisfies readonly { icon: IconName; text: string }[];

/**
 * The first visit, when nothing has been logged, ever, as the first time board draws it: the body map at
 * rest, a title and a sentence, three lines with an icon each, and the two ways in. A button is drawn only
 * when its handler is given, so none is a dead control.
 */
export function TrainFirstTime({
  onSetGoal,
  onLogSession,
  isLogDisabled,
  isStarting = false,
}: TrainFirstTimeProps) {
  return (
    <View className="items-center gap-3 px-2 pt-2">
      <BodyFigure
        label={TRAIN_FIRST_TIME.figureLabel}
        scale="heat"
        side="front"
        values={{}}
        w={84}
      />
      <Text className="mt-2 text-center" role="heading" variant="h2">
        {TRAIN_FIRST_TIME.title}
      </Text>
      <Text className="text-center" tone="secondary">
        {TRAIN_FIRST_TIME.body}
      </Text>
      <View className="mt-2 gap-3 self-stretch" role="list">
        {points.map(({ icon, text }) => (
          <View key={text} accessible className="flex-row items-center gap-3" role="listitem">
            <TrainIconTile name={icon} />
            <Text className="min-w-0 flex-1">{text}</Text>
          </View>
        ))}
      </View>
      {onSetGoal === undefined ? null : (
        <Button className="mt-3" fullWidth onPress={onSetGoal}>
          {TRAIN_FIRST_TIME.goalAction}
        </Button>
      )}
      {onLogSession === undefined ? null : (
        <Button
          disabled={isLogDisabled}
          fullWidth
          loading={isStarting}
          variant="secondary"
          onPress={onLogSession}
        >
          {TRAIN_FIRST_TIME.logAction}
        </Button>
      )}
    </View>
  );
}
