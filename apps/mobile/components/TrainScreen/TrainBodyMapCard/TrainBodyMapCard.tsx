import { BODY_MAP, describeBodyFigureLabel } from "@keylow/core/copy";
import { View } from "react-native";

import { BodyFigure, Button, Card, HeatLegendStrip, IconButton, Text } from "../../ui";
import { ViewLabel } from "../../ViewLabel";

import type { TrainBodyMapCardProps } from "./types";

const FIGURE_WIDTH = 90;

/**
 * The body map on the Train home as its board draws it, compact: the view and its moment on the left, and on
 * the right the button that switches between Actual and Projected and the chevron that opens the body map.
 * Under them are the front and the back at 90 points with the heat legend from Peak to Rested beside them,
 * and, when Projected is off, the line that says why. The figures are plain images, drawn as the figure
 * setting has them, and the front one points to the body map in its name. The card holds no state: the view
 * and its words come from the screen that reads the numbers.
 */
export function TrainBodyMapCard({
  view,
  values,
  body,
  viewLabel,
  subLine,
  toggleLabel,
  isToggleEnabled,
  note,
  onToggle,
  onOpenBodyMap,
}: TrainBodyMapCardProps) {
  const figureLabel = (side: "front" | "back") =>
    describeBodyFigureLabel({
      scale: "heat",
      view,
      side,
      hint: side === "front" ? "openBodyMap" : null,
    });

  return (
    <Card padding={0}>
      <View className="gap-2 px-3 pb-2 pt-3">
        <View className="flex-row flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <View className="min-w-[120px] shrink">
            <ViewLabel isProjected={view === "projected"} label={viewLabel} subLine={subLine} />
          </View>
          <View className="ml-auto shrink-0 flex-row items-center gap-1">
            <Button
              disabled={!isToggleEnabled}
              icon="ArrowRightLeft"
              onPress={onToggle}
              size="sm"
              variant="secondary"
            >
              {toggleLabel}
            </Button>
            {onOpenBodyMap === undefined ? null : (
              <IconButton
                icon="ChevronRight"
                label={BODY_MAP.trainCard.openName}
                tone="secondary"
                variant="ghost"
                onPress={onOpenBodyMap}
              />
            )}
          </View>
        </View>
        <View className="flex-row items-end justify-center gap-[28px]">
          <BodyFigure
            body={body}
            label={figureLabel("front")}
            scale="heat"
            side="front"
            values={values}
            w={FIGURE_WIDTH}
          />
          <BodyFigure
            body={body}
            label={figureLabel("back")}
            scale="heat"
            side="back"
            values={values}
            w={FIGURE_WIDTH}
          />
          <HeatLegendStrip />
        </View>
        {note === null ? null : (
          <Text className="text-center" tone="secondary" variant="caption">
            {note}
          </Text>
        )}
      </View>
    </Card>
  );
}
