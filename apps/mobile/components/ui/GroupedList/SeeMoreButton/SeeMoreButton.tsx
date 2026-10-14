import { PressableSurface } from "../../PressableSurface";
import { Text } from "../../Text";

import type { SeeMoreButtonProps } from "./types";

// The boards draw it as plain text at 14 over 20, semibold, in the secondary text colour, 4 points
// either side of the text. That is not a type token, and the label is 20 points tall, so the button
// reaches the 44 point touch target through its hit slop, 12 above and below. The 14 is marked
// important because it has to beat the body strong variant's own 16, and two font sizes on one
// element have no other order.
const hitSlop = { top: 12, bottom: 12, left: 4, right: 4 };

export function SeeMoreButton({ text, label, onPress }: SeeMoreButtonProps) {
  return (
    <PressableSurface
      className="overflow-hidden rounded-small px-1"
      hitSlop={hitSlop}
      label={label}
      onPress={onPress}
    >
      <Text className="!text-[14px] leading-[20px]" tone="secondary" variant="body-strong">
        {text}
      </Text>
    </PressableSurface>
  );
}
