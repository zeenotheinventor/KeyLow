import { BODY_MAP } from "@keylow/core/copy";
import { useWindowDimensions, View } from "react-native";

import { BodyMapFigures } from "../BodyMapFigures";
import { Button, Card, IconButton, SegmentedControl, Text } from "../ui";
import { ViewLabel } from "../ViewLabel";

import type { BodyMapCardProps } from "./types";

const FIGURE_WIDTH = 140;
const SIDE_BY_SIDE_FIGURE_WIDTH = 150;
// What the figures share the screen's width with, in points: the screen's 16 at each side, the card's 12 of
// padding and 1 of border at each side, and the gap between the figures, 40 for the front and the back and
// 24 for Actual and Projected.
const SIDES_WIDTH = 2 * 16 + 2 * (12 + 1);
const GAP_WIDTH = 40;
const SIDE_BY_SIDE_GAP_WIDTH = 24;

const SIDE_OPTIONS = [
  { value: "front", label: BODY_MAP.sideSwitch.front },
  { value: "back", label: BODY_MAP.sideSwitch.back },
] as const;

/**
 * The body map as its boards draw it: the view label over the front and the back of the body side by side,
 * each with its name under it, and under them the button that switches between Actual and Projected, with
 * the line that goes with it. A tap on the figures switches too. The figures are drawn as the figure setting
 * has them, male unless said, and are plain images. The scale colours them. They are 140 points wide, or
 * narrower on a phone too narrow to hold two of that width.
 *
 * The header row holds the view label and, when `onToggleSideBySide` is given, the Show side by side button
 * at its right. While `sideBySide` is given the card is the side by side view: Actual and Projected
 * together at 150 points, one side of the body each, with the small Front and Back switch in the view
 * label's place. The Show projected button is the screen's to leave out there, with a null label.
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
  selected,
  selectedView,
  onLongPressMuscle,
  overlay,
  sideBySide,
  onSideChange,
  onToggleSideBySide,
  isSideBySideEnabled = true,
}: BodyMapCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isSideBySide = sideBySide !== undefined;
  const figureWidth = Math.min(
    isSideBySide ? SIDE_BY_SIDE_FIGURE_WIDTH : FIGURE_WIDTH,
    Math.floor(
      (screenWidth - SIDES_WIDTH - (isSideBySide ? SIDE_BY_SIDE_GAP_WIDTH : GAP_WIDTH)) / 2,
    ),
  );

  return (
    <Card padding={3}>
      <View className="gap-2">
        <View className="min-h-[40px] flex-row items-start justify-between gap-3">
          {sideBySide === undefined ? (
            <View className="min-w-0 flex-1">
              <ViewLabel
                isProjected={view === "projected" && scale !== "gap"}
                label={viewLabel}
                subLine={subLine}
              />
            </View>
          ) : (
            <View className="w-[160px]">
              <SegmentedControl
                label={BODY_MAP.sideSwitch.name}
                onChange={(side) => {
                  onSideChange?.(side);
                }}
                options={SIDE_OPTIONS}
                size="sm"
                value={sideBySide.side}
              />
            </View>
          )}
          {onToggleSideBySide === undefined ? null : (
            <IconButton
              disabled={!isSideBySideEnabled}
              icon="Columns2"
              isSelected={isSideBySide}
              label={BODY_MAP.sideBySideName}
              onPress={onToggleSideBySide}
              size="card"
            />
          )}
        </View>
        <View>
          <BodyMapFigures
            actualValues={actualValues}
            body={body}
            figureWidth={figureWidth}
            onLongPressMuscle={onLongPressMuscle}
            onTap={isToggleEnabled && !isSideBySide ? onToggle : undefined}
            projectedValues={projectedValues}
            scale={scale}
            selected={selected}
            selectedView={selectedView}
            sideBySide={sideBySide}
            view={view}
          />
          {overlay}
        </View>
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
