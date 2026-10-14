import { View } from "react-native";

import { PressableSurface } from "../PressableSurface";

import type { SwitchProps } from "./types";

// The track is 26 points high, so it reaches the 44 point touch target by taking 9 points above and
// below as its hit slop.
const trackHitSlop = { top: 9, bottom: 9 };

// The classes are written out so Tailwind sees them. On is the accent with the accent foreground knob,
// off is the strong border colour with the primary text colour knob, as the food form boards draw it.
const looks = {
  on: { trackClassName: "bg-accent", knobClassName: "left-[21px] bg-accent-foreground" },
  off: { trackClassName: "bg-border-strong", knobClassName: "left-[3px] bg-text-primary" },
};

/**
 * An on and off choice, such as the food form's default portion. It is a design system addition drawn
 * only on the food form boards, so its sizes are the boards': a 44 by 26 track and a 20 point knob. The
 * state changes at once and plays the selection haptic. The knob does not slide, because the plan's
 * motion scope has no switch motion.
 */
export function Switch({ isOn, label, onValueChange }: SwitchProps) {
  const look = looks[isOn ? "on" : "off"];

  return (
    <PressableSurface
      checked={isOn}
      className={`h-[26px] w-touch-target overflow-hidden rounded-pill ${look.trackClassName}`}
      haptic="select"
      hitSlop={trackHitSlop}
      label={label}
      role="switch"
      onPress={() => {
        onValueChange(!isOn);
      }}
    >
      <View
        aria-hidden
        className={`absolute top-[3px] h-[20px] w-[20px] rounded-pill ${look.knobClassName}`}
      />
    </PressableSurface>
  );
}
