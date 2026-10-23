import { BODY_MAP, describeBodyFigureLabel } from "@keylow/core/copy";
import { vars } from "nativewind";
import { useEffect, useState } from "react";
import { PanResponder, View } from "react-native";
import Animated from "react-native-reanimated";

import { useCrossFade } from "../../lib/motion";
import { useScreenReaderEnabled } from "../../lib/screenReader";
import { BodyFigure, Text } from "../ui";
import { ViewName } from "../ViewLabel";

import type { BodyMapFiguresProps } from "./types";
import type { BodyMapView, MuscleId } from "@keylow/core/training";

const SIDES = ["front", "back"] as const;
const SIDE_BY_SIDE_VIEWS = ["actual", "projected"] as const;

// A touch that moves further than this from where it went down is a pan, and never a tap. A muscle button
// applies the same slop to its own press.
const TAP_SLOP = 10;

// How strongly the muscles that are not the selected one show while a sheet is open on it.
const UNSELECTED_OPACITY = 0.4;

function noop() {
  // A short press on a muscle of the side by side view changes nothing.
}

// Passes a tap on to whichever `onTap` is listening, which changes as the screen draws again.
function createTapRelay() {
  let listener: (() => void) | undefined;

  return {
    listen: (next: (() => void) | undefined) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
    tap: () => {
      listener?.();
    },
  };
}

/**
 * The front and the back of the body side by side, each with its name under it, coloured by the scale. A tap anywhere on them
 * calls `onTap`; a pan, or a touch the screen takes over to scroll, never does. Without a long press handler
 * the figures stay plain images, so a screen reader reaches the view through the toggle button and not
 * through this tap. With one, each muscle is a button as `BodyFigure` makes it: a long press on it calls
 * `onLongPressMuscle`, and a short press that lifts within the slop of where it went down is still a tap on
 * the figures. A screen reader has no long press, so while one is running a muscle's plain activation calls
 * `onLongPressMuscle` and the muscle offers Show details as well. `selected` outlines a muscle and dims the others. When
 * the view changes the old figures fade out under the new ones over 220 ms, and are hidden from a screen
 * reader while they do.
 *
 * With `sideBySide` the figures are Actual and Projected together, one side of each at the one figure width,
 * with the view's name over it and its moment under it. Both views show, so a tap on them does nothing,
 * a short press on a muscle does nothing, and a long press calls `onLongPressMuscle` with the view of the
 * figure it was on. `selected` outlines its muscle on the figure of `selectedView` only.
 */
export function BodyMapFigures({
  scale,
  view,
  actualValues,
  projectedValues,
  body,
  figureWidth,
  selected,
  selectedView,
  onTap,
  onLongPressMuscle,
  sideBySide,
  hasMuscleList = false,
}: BodyMapFiguresProps) {
  const { outgoing, incomingStyle, outgoingStyle } = useCrossFade(view, view);
  const isScreenReaderEnabled = useScreenReaderEnabled();
  // Only a fade in progress styles the new layer; at rest it is drawn plain.
  const incomingLayerStyle = outgoing === null ? undefined : incomingStyle;
  const valuesOf = (shown: BodyMapView) => (shown === "projected" ? projectedValues : actualValues);
  // Only the front figure says where each muscle's values are, once there is a muscle list.
  const hintOf = (side: (typeof SIDES)[number]) =>
    hasMuscleList && side === "front" ? "muscleList" : null;

  // The responder is made once, because one made again in the middle of a touch would start with no memory
  // of where the finger went down. The relay hands a tap to the latest `onTap`.
  const [tapRelay] = useState(createTapRelay);
  useEffect(() => tapRelay.listen(onTap), [tapRelay, onTap]);
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_event, { dx, dy }) => {
        if (Math.hypot(dx, dy) <= TAP_SLOP) {
          tapRelay.tap();
        }
      },
    }),
  );

  if (sideBySide !== undefined) {
    return (
      <View className="flex-row justify-center gap-6">
        {SIDE_BY_SIDE_VIEWS.map((shown) => (
          // The column is no wider than its figure, so a long caption wraps under it and cannot push the
          // row past the card. The width is the figure's, which the screen's width decides.
          <View
            key={shown}
            className="w-[var(--figure-width)] items-center gap-2"
            style={vars({ "--figure-width": figureWidth })}
          >
            <ViewName
              isProjected={shown === "projected"}
              label={BODY_MAP.views[shown]}
              textVariant="label-small"
            />
            <BodyFigure
              body={body}
              label={describeBodyFigureLabel({
                scale,
                view: shown,
                side: sideBySide.side,
                hint: null,
              })}
              scale={scale}
              side={sideBySide.side}
              values={valuesOf(shown)}
              w={figureWidth}
              selected={selectedView === shown ? selected : undefined}
              unselectedOpacity={UNSELECTED_OPACITY}
              // A short press does nothing here, since both views show. A screen reader has no long
              // press, so there the plain activation opens the details.
              {...(onLongPressMuscle === undefined
                ? {}
                : {
                    onLongPressMuscle: (muscle: MuscleId) => {
                      onLongPressMuscle(muscle, shown);
                    },
                    onPressMuscle: isScreenReaderEnabled
                      ? (muscle: MuscleId) => {
                          onLongPressMuscle(muscle, shown);
                        }
                      : noop,
                  })}
            />
            <Text className="text-center" tone="muted" variant="caption">
              {shown === "projected" ? sideBySide.projectedCaption : sideBySide.actualCaption}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="flex-row justify-center gap-10" {...panResponder.panHandlers}>
      {SIDES.map((side) => (
        <View key={side} className="items-center gap-1">
          <View>
            {outgoing === null ? null : (
              <View aria-hidden className="absolute inset-0" pointerEvents="none">
                <Animated.View style={outgoingStyle}>
                  <BodyFigure
                    body={body}
                    label={describeBodyFigureLabel({
                      scale,
                      view: outgoing,
                      side,
                      hint: hintOf(side),
                    })}
                    scale={scale}
                    side={side}
                    values={valuesOf(outgoing)}
                    w={figureWidth}
                  />
                </Animated.View>
              </View>
            )}
            <Animated.View style={incomingLayerStyle}>
              <BodyFigure
                body={body}
                label={describeBodyFigureLabel({ scale, view, side, hint: hintOf(side) })}
                scale={scale}
                side={side}
                values={valuesOf(view)}
                w={figureWidth}
                selected={selected}
                unselectedOpacity={UNSELECTED_OPACITY}
                // A handler makes every muscle a button that takes the touch first, so a short press on one
                // is handed on as the tap of the figures, and a long press goes to the screen. A screen
                // reader has no long press, so there the plain activation opens the details.
                {...(onLongPressMuscle === undefined
                  ? {}
                  : {
                      onLongPressMuscle: (muscle: MuscleId) => {
                        onLongPressMuscle(muscle, view);
                      },
                      onPressMuscle: isScreenReaderEnabled
                        ? (muscle: MuscleId) => {
                            onLongPressMuscle(muscle, view);
                          }
                        : tapRelay.tap,
                    })}
              />
            </Animated.View>
          </View>
          <Text tone="muted" variant="caption">
            {BODY_MAP.sideSwitch[side]}
          </Text>
        </View>
      ))}
    </View>
  );
}
