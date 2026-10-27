import { BODY_LONG_PRESS_DELAY_MILLISECONDS, BODY_TAP_SLOP } from "@keylow/body-3d/touch";
import { BODY_MAP, MUSCLE_NAMES } from "@keylow/core/copy";
import { BODY_ARTWORK, BODY_GLOW_FILTER, isMuscleId } from "@keylow/core/training";
import { bodyMapPalette } from "@keylow/tokens";
import { vars } from "nativewind";
import { useId, useMemo, useRef } from "react";
import { Pressable, View } from "react-native";
import Svg, { Defs, FeGaussianBlur, FeMerge, FeMergeNode, Filter, G, Path } from "react-native-svg";

import { figureHeightOf, hitBoxes } from "./hitBoxes";
import { readMuscle } from "./muscleReading";
import { defaultBodyFigure } from "../../../lib/bodyFigure";
import { useTheme } from "../../../lib/theme";

import type { BodyFigureProps } from "./types";
import type { AccessibilityActionEvent, GestureResponderEvent } from "react-native";

const OUTLINE_WIDTH = 1.4;
const SELECTED_OUTLINE_WIDTH = 2.6;

// The screen reader action that does what a long press does for a finger.
const DETAILS_ACTION = "details";

type TouchPoint = { x: number; y: number };

const pointOf = ({ nativeEvent }: GestureResponderEvent): TouchPoint => ({
  x: nativeEvent.pageX,
  y: nativeEvent.pageY,
});

/**
 * One side of the body as a drawing of the 22 muscles, filled from the heat, volume or gap scale. It is
 * one image with the label. With a handler, each muscle is also a button named by the muscle and its value,
 * so a screen reader reaches every one, and a press anywhere else on the figure goes to the press around it.
 * A finger that drags more than 10 points from where it went down on a muscle neither presses nor long
 * presses it. With a long press handler each muscle also offers a Show details action, so a screen reader
 * can do what a long press does.
 * The fills are concrete colours from the palette, because an SVG fill cannot read a CSS variable.
 */
export function BodyFigure({
  side,
  scale,
  values,
  body = defaultBodyFigure,
  selected,
  dim = 1,
  unselectedOpacity = 1,
  label,
  w,
  onPressMuscle,
  onLongPressMuscle,
}: BodyFigureProps) {
  const { scheme, colors } = useTheme();
  const palette = bodyMapPalette(scheme);
  // One filter for each figure, so two figures on a screen never share a name. The name is also kept to
  // letters and digits, which is all the SVG reference reads reliably.
  const glowName = `glow${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const artwork = BODY_ARTWORK[body][side];
  const hasHandler = onPressMuscle !== undefined || onLongPressMuscle !== undefined;
  const boxes = useMemo(() => hitBoxes(side, body, w), [side, body, w]);
  // Where the finger on this figure went down and where it is now, which the pressables do not keep.
  const touch = useRef<{ origin: TouchPoint | null; latest: TouchPoint | null }>({
    origin: null,
    latest: null,
  });
  const isDragged = () => {
    const { origin, latest } = touch.current;
    return origin !== null && latest !== null
      ? Math.hypot(latest.x - origin.x, latest.y - origin.y) > BODY_TAP_SLOP
      : false;
  };

  const muscles = Object.entries(artwork.muscles).flatMap(([id, path]) => {
    if (!isMuscleId(id)) {
      return [];
    }
    return [{ id, path, ...readMuscle(scale, values[id], palette) }];
  });
  const hasGlow = muscles.some((muscle) => muscle.isPeak);

  return (
    <View
      className="h-[var(--figure-height)] w-[var(--figure-width)]"
      style={vars({ "--figure-width": w, "--figure-height": figureHeightOf(w) })}
    >
      <View accessible aria-label={label} className="h-full w-full" role="img">
        <Svg height="100%" viewBox={artwork.viewBox} width="100%">
          {hasGlow && (
            <Defs>
              <Filter
                height={BODY_GLOW_FILTER.height}
                id={glowName}
                width={BODY_GLOW_FILTER.width}
                x={BODY_GLOW_FILTER.x}
                y={BODY_GLOW_FILTER.y}
              >
                <FeGaussianBlur
                  in="SourceGraphic"
                  result="blur"
                  stdDeviation={BODY_GLOW_FILTER.standardDeviation}
                />
                <FeMerge>
                  {BODY_GLOW_FILTER.mergeLayers.map((layer, position) => (
                    <FeMergeNode
                      key={`${layer}-${position}`}
                      in={layer === "blur" ? "blur" : "SourceGraphic"}
                    />
                  ))}
                </FeMerge>
              </Filter>
            </Defs>
          )}
          <G opacity={dim}>
            <Path d={artwork.head} fill={palette.silhouette} />
            <Path d={artwork.outline} fill={palette.silhouette} />
            {muscles.map((muscle) => (
              <Path
                key={muscle.id}
                d={muscle.path}
                fill={muscle.fill}
                stroke={muscle.id === selected ? colors["text-primary"] : palette.separator}
                opacity={selected !== undefined && muscle.id !== selected ? unselectedOpacity : 1}
                strokeLinejoin="round"
                strokeWidth={muscle.id === selected ? SELECTED_OUTLINE_WIDTH : OUTLINE_WIDTH}
                {...(muscle.isPeak ? { filter: `url(#${glowName})` } : {})}
              />
            ))}
          </G>
        </Svg>
      </View>
      {hasHandler &&
        boxes.map((box) => {
          const { valueName } = readMuscle(scale, values[box.muscle], palette);
          return (
            <Pressable
              key={`${box.muscle}-${box.left}-${box.top}`}
              aria-hidden={!box.isReadOut}
              aria-label={`${MUSCLE_NAMES[box.muscle]}, ${valueName}`}
              className="absolute left-[var(--hit-left)] top-[var(--hit-top)] h-[var(--hit-height)] w-[var(--hit-width)]"
              delayLongPress={BODY_LONG_PRESS_DELAY_MILLISECONDS}
              role="button"
              style={vars({
                "--hit-left": box.left,
                "--hit-top": box.top,
                "--hit-width": box.width,
                "--hit-height": box.height,
              })}
              {...(onLongPressMuscle === undefined
                ? {}
                : {
                    accessibilityActions: [
                      { name: DETAILS_ACTION, label: BODY_MAP.muscleDetailsAction },
                    ],
                    onAccessibilityAction: ({ nativeEvent }: AccessibilityActionEvent) => {
                      if (nativeEvent.actionName === DETAILS_ACTION) {
                        onLongPressMuscle(box.muscle);
                      }
                    },
                  })}
              onLongPress={
                onLongPressMuscle &&
                (() => {
                  if (!isDragged()) {
                    onLongPressMuscle(box.muscle);
                  }
                })
              }
              onPress={
                onPressMuscle &&
                ((event) => {
                  touch.current.latest = pointOf(event);
                  if (!isDragged()) {
                    onPressMuscle(box.muscle);
                  }
                })
              }
              onPressIn={(event) => {
                const point = pointOf(event);
                touch.current = { origin: point, latest: point };
              }}
              onTouchMove={(event) => {
                touch.current.latest = pointOf(event);
              }}
            />
          );
        })}
    </View>
  );
}
