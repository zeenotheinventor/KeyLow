import { BODY_MAP, describeBodyFigureLabel } from "@keylow/core/copy";
import { View, useWindowDimensions } from "react-native";

import { BodyFigure, Card, Text } from "../ui";
import { ViewLabel } from "../ViewLabel";

import type { BodyMapCardProps } from "./types";

const FIGURE_WIDTH = 140;
// What the figures share the screen's width with, in points: the screen's 16 at each side, the card's 12 of
// padding and 1 of border at each side, and the 40 between the figures.
const SIDES_AND_GAP_WIDTH = 2 * 16 + 2 * (12 + 1) + 40;
const SIDES = ["front", "back"] as const;

/**
 * The body map as its board draws it: the view label over the front and the back of the body side by side,
 * each with its name under it. The figures are drawn male until the figure setting exists, and are plain
 * images. They are 140 points wide, or narrower on a phone too narrow to hold two of that width.
 */
export function BodyMapCard({ values, viewLabel, subLine }: BodyMapCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const figureWidth = Math.min(FIGURE_WIDTH, Math.floor((screenWidth - SIDES_AND_GAP_WIDTH) / 2));

  return (
    <Card padding={3}>
      <View className="gap-2">
        <ViewLabel label={viewLabel} subLine={subLine} />
        <View className="flex-row justify-center gap-10">
          {SIDES.map((side) => (
            <View key={side} className="items-center gap-1">
              <BodyFigure
                label={describeBodyFigureLabel({ scale: "heat", view: "actual", side, hint: null })}
                scale="heat"
                side={side}
                values={values}
                w={figureWidth}
              />
              <Text tone="muted" variant="caption">
                {BODY_MAP.sideSwitch[side]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
