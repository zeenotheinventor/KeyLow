import { describeMusclesTrained, FINISH_SCREEN } from "@keylow/core/copy";
import { sessionHeatValues, sessionMuscleSets, TRAINING_PARAMS_V2 } from "@keylow/core/training";
import { useMemo } from "react";
import { View } from "react-native";

import { useBodyFigure } from "../../lib/bodyFigure";
import { BodyFigure, Card, Text } from "../ui";
import { TrainedMuscleRow } from "./TrainedMuscleRow";

import type { MusclesTrainedCardProps } from "./types";

const FIGURE_WIDTH = 64;
const SIDES = ["front", "back"] as const;

/**
 * The Muscles trained card, on the finish screen and on a past session: the front and the back of the body
 * at 64 points, filled with the heat of this session's sets alone, and beside them the muscles it trained
 * with their effective sets, most first, each with the swatch of the step its figure is filled with. A
 * session with no working sets trained nothing, so the card is left out. The figures are drawn as the
 * figure setting has them, male or female, and the card waits for the stored setting, which the phone gives
 * at once, so it never draws the wrong figure first.
 */
export function MusclesTrainedCard({ sets, at }: MusclesTrainedCardProps) {
  const { rows, heatSteps } = useMemo(
    () => ({
      rows: sessionMuscleSets(sets, TRAINING_PARAMS_V2),
      heatSteps: sessionHeatValues(sets, at, TRAINING_PARAMS_V2),
    }),
    [sets, at],
  );

  const { figure, isReady: isFigureReady } = useBodyFigure();

  if (rows.length === 0 || !isFigureReady) {
    return null;
  }

  return (
    <Card aria-label={FINISH_SCREEN.musclesHeading} padding={3} role="region">
      <View className="gap-2">
        <View className="flex-row items-baseline justify-between">
          <Text role="heading" variant="body-strong">
            {FINISH_SCREEN.musclesHeading}
          </Text>
          <Text tone="muted" variant="caption">
            {FINISH_SCREEN.effectiveSetsCaption}
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          <View className="flex-row gap-2">
            {SIDES.map((side) => (
              <BodyFigure
                key={side}
                body={figure}
                label={FINISH_SCREEN.figureNames[side]}
                scale="heat"
                side={side}
                values={heatSteps}
                w={FIGURE_WIDTH}
              />
            ))}
          </View>
          <View className="flex-1 gap-[2px]" role="list">
            {describeMusclesTrained(rows).map(({ muscle, name, value }) => (
              <TrainedMuscleRow
                key={muscle}
                heatStep={heatSteps[muscle]}
                name={name}
                value={value}
              />
            ))}
          </View>
        </View>
      </View>
    </Card>
  );
}
