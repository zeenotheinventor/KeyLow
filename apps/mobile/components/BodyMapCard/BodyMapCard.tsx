import { BODY_MAP } from "@keylow/core/copy";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";

import { BodyMapFigures } from "../BodyMapFigures";
import { useBody3DLayout } from "../BodyView";
import { Button, Card, IconButton, SegmentedControl, Text } from "../ui";
import { ViewLabel } from "../ViewLabel";

import type { BodyMapCardProps } from "./types";
import type { BodyArtworkSide } from "@keylow/core/training";

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
 *
 * When the person chose 3D in More and the figure has a 3D body, the card is laid out for it, as the 3D boards
 * draw it: the view label over one body on a dark stage, the Front and Back switch and the toggle button on the
 * row under it, the note, and under the card the line that says to drag. A tap on the body toggles the view
 * as it does in 2D, and the switch and a drag turn it. The card keeps the layout if 3D fails after it is
 * drawn, with the 2D figure in the stage. The side by side view stays 2D, and so does everything else on 2D,
 * which is the default.
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
  hasMuscleList = false,
}: BodyMapCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isSideBySide = sideBySide !== undefined;
  const isIn3d = useBody3DLayout(body) && !isSideBySide;
  // The side the 3D body faces, which the switch under it and a drag of the body both set.
  const [side3d, setSide3d] = useState<BodyArtworkSide>("front");
  const figureWidth = Math.min(
    isSideBySide ? SIDE_BY_SIDE_FIGURE_WIDTH : FIGURE_WIDTH,
    Math.floor(
      (screenWidth - SIDES_WIDTH - (isSideBySide ? SIDE_BY_SIDE_GAP_WIDTH : GAP_WIDTH)) / 2,
    ),
  );

  const header = (
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
  );
  const toggleButton = (label: string, className: string) => (
    <Button
      className={className}
      disabled={!isToggleEnabled}
      icon="ArrowRightLeft"
      onPress={onToggle}
      size="sm"
      variant="secondary"
    >
      {label}
    </Button>
  );
  const noteText =
    note === null ? null : (
      <Text className="px-2 pb-[2px] pt-1 text-center" tone="secondary" variant="caption">
        {note}
      </Text>
    );

  if (isIn3d) {
    return (
      <>
        <Card padding={3}>
          <View className="gap-2">
            {header}
            <BodyMapFigures
              actualValues={actualValues}
              body={body}
              figureWidth={figureWidth}
              hasMuscleList={hasMuscleList}
              in3d={{ side: side3d, onSideChange: setSide3d }}
              onTap={isToggleEnabled ? onToggle : undefined}
              projectedValues={projectedValues}
              scale={scale}
              selected={selected}
              view={view}
            />
            <View className="flex-row items-center justify-between gap-2">
              <View className="w-[150px]">
                <SegmentedControl
                  hint={BODY_MAP.sideSwitchDescription}
                  label={BODY_MAP.sideSwitch.name}
                  onChange={setSide3d}
                  options={SIDE_OPTIONS}
                  size="sm"
                  value={side3d}
                />
              </View>
              {toggleLabel === null ? null : toggleButton(toggleLabel, "")}
            </View>
            {noteText}
          </View>
        </Card>
        <Text className="text-center" tone="muted" variant="caption">
          {BODY_MAP.rotateHint}
        </Text>
      </>
    );
  }

  return (
    <Card padding={3}>
      <View className="gap-2">
        {header}
        <View>
          <BodyMapFigures
            actualValues={actualValues}
            body={body}
            figureWidth={figureWidth}
            hasMuscleList={hasMuscleList}
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
        {toggleLabel === null ? null : toggleButton(toggleLabel, "self-center")}
        {noteText}
      </View>
    </Card>
  );
}
