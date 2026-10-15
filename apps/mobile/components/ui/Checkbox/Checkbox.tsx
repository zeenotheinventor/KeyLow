import { Pressable } from "react-native";

import { haptic } from "../../../lib/haptics";
import { Text } from "../Text";
import { BoxFill } from "./BoxFill";
import { CheckMark } from "./CheckMark";
import { plainText } from "./plainText";

import type { CheckboxProps } from "./types";

/**
 * A choice the person ticks, such as accepting the terms on sign-up. Only the 22 point box is the
 * checkbox to a screen reader, so a link in the label stays a control of its own. The row around it
 * takes the same press for people touching the words or the gap, and a link in the label handles its
 * own press and leaves the box as it is. The state changes at once and plays the selection haptic,
 * the box changes its look over the quick duration, and the tick punches in (a fade with reduced
 * motion). A disabled box is dimmed to half and does not respond.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  accessibilityLabel,
}: CheckboxProps) {
  const toggle = () => {
    void haptic.select();
    onChange(!checked);
  };

  return (
    <Pressable
      accessible={false}
      className={`min-h-touch-target flex-row items-start gap-3 ${disabled ? "opacity-50" : ""}`}
      disabled={disabled}
      onPress={toggle}
    >
      <Pressable
        aria-checked={checked}
        aria-disabled={disabled}
        aria-label={accessibilityLabel ?? plainText(label)}
        className="mt-px h-[22px] w-[22px] shrink-0 items-center justify-center"
        disabled={disabled}
        role="checkbox"
        onPress={toggle}
      >
        <BoxFill isTicked={checked} />
        {checked ? <CheckMark /> : null}
      </Pressable>
      {/* The design sets the body style at 14 over 20, which no Text variant has in regular weight. A
          plain label is hidden from screen readers because the box already says it, and one with links
          stays reachable so each link can be focused. */}
      <Text
        aria-hidden={typeof label === "string"}
        className="flex-1 pt-[2px] !text-[14px] leading-[20px]"
      >
        {label}
      </Text>
    </Pressable>
  );
}
