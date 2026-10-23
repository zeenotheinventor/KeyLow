import { describeMusclesTrained, FINISH_SCREEN } from "@keylow/core/copy";
import { sessionHeatValues, sessionMuscleSets, TRAINING_PARAMS_V1 } from "@keylow/core/training";
import { useMemo } from "react";
import { View } from "react-native";

import { BodyFigure, Card, Text } from "../ui";
import { TrainedMuscleRow } from "./TrainedMuscleRow";

import type { MusclesTrainedCardProps } from "./types";

const FIGURE_WIDTH = 64;
const SIDES = ["front", "back"] as const;

/**
 * The Muscles trained card, on the finish screen and on a past session: the front and the back of the body
 * at 64 points, filled with the heat of this session's sets alone, and beside them the muscles it trained
 * with their effective sets, most first, each with the swatch of the step its figure is filled with. A
 * session with no working sets trained nothing, so the card is left out.
 */
export function MusclesTrainedCard({ sets, at }: MusclesTrainedCardProps) {
  const { rows, heatSteps } = useMemo(
    () => ({
      rows: sessionMuscleSets(sets, TRAINING_PARAMS_V1),
      heatSteps: sessionHeatValues(sets, at, TRAINING_PARAMS_V1),
    }),
    [sets, at],
  );

  if (rows.length === 0) {
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
              // The figure setting (KEY-430) plugs in here as the figure's `body`; until it exists the male is drawn, as on the body map.
              <BodyFigure
                key={side}
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
