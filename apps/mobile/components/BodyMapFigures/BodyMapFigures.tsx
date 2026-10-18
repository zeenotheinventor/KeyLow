import { BODY_MAP, describeBodyFigureLabel } from "@keylow/core/copy";
import { useEffect, useState } from "react";
import { PanResponder, View } from "react-native";
import Animated from "react-native-reanimated";

import { useCrossFade } from "../../lib/motion";
import { BodyFigure, Text } from "../ui";

import type { BodyMapFiguresProps } from "./types";
import type { BodyMapView } from "@keylow/core/training";

const SIDES = ["front", "back"] as const;

// A touch that moves further than this from where it went down is a pan, and never a tap.
const TAP_SLOP = 10;

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
 * The front and the back of the body side by side, each with its name under it. A tap anywhere on them
 * calls `onTap`; a pan, or a touch the screen takes over to scroll, never does. The figures stay plain
 * images, so a screen reader reaches the view through the toggle button and not through this tap. When
 * the view changes the old figures fade out under the new ones over 220 ms, and are hidden from a screen
 * reader while they do.
 */
export function BodyMapFigures({
  view,
  actualValues,
  projectedValues,
  figureWidth,
  onTap,
}: BodyMapFiguresProps) {
  const { outgoing, incomingStyle, outgoingStyle } = useCrossFade(view, view);
  const valuesOf = (shown: BodyMapView) => (shown === "projected" ? projectedValues : actualValues);

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

  return (
    <View className="flex-row justify-center gap-10" {...panResponder.panHandlers}>
      {SIDES.map((side) => (
        <View key={side} className="items-center gap-1">
          <View>
            {outgoing === null ? null : (
              <View aria-hidden className="absolute inset-0" pointerEvents="none">
                <Animated.View style={outgoingStyle}>
                  <BodyFigure
                    label={describeBodyFigureLabel({
                      scale: "heat",
                      view: outgoing,
                      side,
                      hint: null,
                    })}
                    scale="heat"
                    side={side}
                    values={valuesOf(outgoing)}
                    w={figureWidth}
                  />
                </Animated.View>
              </View>
            )}
            <Animated.View style={outgoing === null ? undefined : incomingStyle}>
              <BodyFigure
                label={describeBodyFigureLabel({ scale: "heat", view, side, hint: null })}
                scale="heat"
                side={side}
                values={valuesOf(view)}
                w={figureWidth}
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
