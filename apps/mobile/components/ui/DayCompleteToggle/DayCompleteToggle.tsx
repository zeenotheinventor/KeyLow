import { DAY_COMPLETE_TOGGLE } from "@keylow/core";
import { useState } from "react";
import { View } from "react-native";

import { useReducedMotion } from "../../../lib/motion";
import { PressableSurface } from "../PressableSurface";
import { Switch } from "../Switch";
import { Text } from "../Text";
import { PunchLabel } from "./PunchLabel";
import { SlashSweep } from "./SlashSweep";

import type { DayCompleteToggleProps } from "./types";

// The classes are written out so Tailwind sees them. Complete is the accent fill and border, as the
// card draws it, and the row dims to half when it is disabled.
const frameClassName =
  "min-h-[56px] w-full flex-row items-center gap-3 overflow-hidden rounded-medium border px-4 py-2";
const lookClassName = {
  off: "border-border bg-surface",
  complete: "border-accent bg-accent-muted",
};

/**
 * Marks a diary day complete so the energy engine can use it. Completing is a moment: an accent slash
 * crosses the row, the label punches in and the complete haptic plays. Unmarking is quiet. With
 * reduced motion there is no slash and no punch. The row is the switch, and the track on it is only
 * drawn. The moment belongs to a press from the off state, so a day that turns complete by itself, such
 * as the diary stepping to a complete day, plays nothing. The diary should key the toggle by day
 * (`key={dayKey}`). A press the parent has not answered stays armed until `complete` changes or the
 * toggle is keyed anew, so a parent may answer after a server reply. The diary should key it anew
 * when the complete mutation fails too, so a lingering press cannot play the moment for a later sync
 * of the same day.
 */
export function DayCompleteToggle({
  complete = false,
  onChange,
  disabled = false,
  className = "",
}: DayCompleteToggleProps) {
  const isReducedMotion = useReducedMotion();
  const [moments, setMoments] = useState(0);
  const [wasComplete, setWasComplete] = useState(complete);
  const [isAwaitingComplete, setIsAwaitingComplete] = useState(false);
  const [isMomentLive, setIsMomentLive] = useState(false);

  // A new moment when the day becomes complete after a press from the off state. Any change of
  // `complete` uses up the press and ends the moment before it, so a change that nobody pressed for
  // plays nothing.
  if (wasComplete !== complete) {
    const isMoment = complete && isAwaitingComplete;
    setWasComplete(complete);
    setIsAwaitingComplete(false);
    setIsMomentLive(isMoment);
    if (isMoment) {
      setMoments((count) => count + 1);
    }
  }

  const hasMoment = isMomentLive && !isReducedMotion;

  return (
    <View className={className}>
      <PressableSurface
        checked={complete}
        className={`${frameClassName} ${lookClassName[complete ? "complete" : "off"]} ${disabled ? "opacity-50" : ""}`}
        disabled={disabled}
        haptic={complete ? undefined : "complete"}
        role="switch"
        onPress={() => {
          setIsAwaitingComplete(!complete);
          onChange?.(!complete);
        }}
      >
        <View className="flex-1">
          <PunchLabel key={moments} isPunching={hasMoment}>
            <Text variant="body-strong">
              {complete ? DAY_COMPLETE_TOGGLE.complete : DAY_COMPLETE_TOGGLE.markComplete}
            </Text>
          </PunchLabel>
          <Text variant="caption" tone="muted">
            {complete
              ? DAY_COMPLETE_TOGGLE.completeCaption
              : DAY_COMPLETE_TOGGLE.markCompleteCaption}
          </Text>
        </View>
        <Switch isDecorative isOn={complete} onKnobIcon="Check" />
        {hasMoment ? <SlashSweep key={moments} /> : null}
      </PressableSurface>
    </View>
  );
}
