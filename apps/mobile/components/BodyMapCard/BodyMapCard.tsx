import { useWindowDimensions, View } from "react-native";

import { BodyMapFigures } from "../BodyMapFigures";
import { Button, Card, Text } from "../ui";
import { ViewLabel } from "../ViewLabel";

import type { BodyMapCardProps } from "./types";

const FIGURE_WIDTH = 140;
// What the figures share the screen's width with, in points: the screen's 16 at each side, the card's 12 of
// padding and 1 of border at each side, and the 40 between the figures.
const SIDES_AND_GAP_WIDTH = 2 * 16 + 2 * (12 + 1) + 40;

/**
 * The body map as its boards draw it: the view label over the front and the back of the body side by side,
 * each with its name under it, and under them the button that switches between Actual and Projected, with
 * the line that goes with it. A tap on the figures switches too. The figures are drawn as the figure setting
 * has them, male unless said, and are plain images. The scale colours them. They are 140 points wide, or
 * narrower on a phone too narrow to hold two of that width.
 */
export function BodyMapCard({
  scale,
  view,
  actualValues,
  projectedValues,
  body,
  viewLabel,
  subLine,
  toggleLabel,
  isToggleEnabled,
  onToggle,
  note,
}: BodyMapCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const figureWidth = Math.min(FIGURE_WIDTH, Math.floor((screenWidth - SIDES_AND_GAP_WIDTH) / 2));

  return (
    <Card padding={3}>
      <View className="gap-2">
        <ViewLabel
          isProjected={view === "projected" && scale !== "gap"}
          label={viewLabel}
          subLine={subLine}
        />
        <BodyMapFigures
          actualValues={actualValues}
          body={body}
          figureWidth={figureWidth}
          onTap={isToggleEnabled ? onToggle : undefined}
          projectedValues={projectedValues}
          scale={scale}
          view={view}
        />
        {toggleLabel === null ? null : (
          <Button
            className="self-center"
            disabled={!isToggleEnabled}
            icon="ArrowRightLeft"
            onPress={onToggle}
            size="sm"
            variant="secondary"
          >
            {toggleLabel}
          </Button>
        )}
        {note === null ? null : (
          <Text className="px-2 pb-[2px] pt-1 text-center" tone="secondary" variant="caption">
            {note}
          </Text>
        )}
      </View>
    </Card>
  );
}
