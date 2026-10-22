import { View } from "react-native";

import { Icon } from "../Icon";
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

const trackClassName = "h-[26px] w-touch-target overflow-hidden rounded-pill";

// The check on the day complete switch's knob is 12 points, as its card draws it.
const knobIconSize = 12;

/**
 * An on and off choice, such as the food form's default portion. It is a design system addition drawn
 * only on the food form boards, so its sizes are the boards': a 44 by 26 track and a 20 point knob. The
 * state changes at once and plays the selection haptic. The knob does not slide, because the plan's
 * motion scope has no switch motion.
 *
 * Two opt-in props serve the day complete row, which draws the same track and knob: `isDecorative`
 * draws only the track and knob, and `onKnobIcon` puts an icon on the knob while the switch is on.
 */
export function Switch(props: SwitchProps) {
  const look = looks[props.isOn ? "on" : "off"];
  const knob = (
    <View
      aria-hidden
      className={`absolute top-[3px] h-[20px] w-[20px] items-center justify-center rounded-pill ${look.knobClassName}`}
    >
      {props.isOn && props.onKnobIcon !== undefined ? (
        <Icon name={props.onKnobIcon} size={knobIconSize} tone="accent" />
      ) : null}
    </View>
  );

  if (props.isDecorative === true) {
    return (
      <View aria-hidden className={`${trackClassName} ${look.trackClassName}`}>
        {knob}
      </View>
    );
  }

  const { isOn, label, onValueChange, disabled = false } = props;
  return (
    <PressableSurface
      checked={isOn}
      className={`${trackClassName} ${look.trackClassName} ${disabled ? "opacity-50" : ""}`}
      disabled={disabled}
      haptic="select"
      hitSlop={trackHitSlop}
      label={label}
      role="switch"
      onPress={() => {
        onValueChange(!isOn);
      }}
    >
      {knob}
    </PressableSurface>
  );
}
