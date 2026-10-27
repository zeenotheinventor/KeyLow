import { BODY_MAP } from "@keylow/core/copy";
import { controlHeight, touchTarget } from "@keylow/tokens";
import { Text as NativeText, View } from "react-native";

import { Icon, PressableSurface, Text } from "../ui";

import type { BodyMapHintProps } from "./types";

// The kit Toast's box, so the two read alike, with the padding the board gives the hint: 4 above, below and
// at the right, 12 at the left. The Toast is anchored to the top of the screen by its provider, so it
// cannot sit on a card, and this strip is laid over the figures by the card instead.
const boxClassName =
  "min-h-touch-target flex-row items-center gap-3 rounded-medium border border-border bg-surface-sheet py-1 pl-3 pr-1 elevation-toast";
// 24 from the card's edge, and the card pads its contents by 12. Two thirds of the way down the figures,
// where the board lays the strip over the legs. A share of the height keeps it there when the figures are
// narrower on a small phone.
const placementClassName = "absolute inset-x-3 top-[67%] z-10";

// The Got it button is 36 points high, so it reaches the 44 point touch target by taking the rest as hit slop above and below.
const dismissSlop = (touchTarget - controlHeight.sm) / 2;
const dismissHitSlop = { top: dismissSlop, bottom: dismissSlop };

/**
 * The line the body map draws once, on its first open on a device: a hand, "Long-press a muscle for
 * details" and Got it. It is a strip like the Toast, laid over the figures by the body map card, and it has
 * no timer: it stays until the person presses Got it or opens a muscle's sheet. The words are one group
 * with the status role, and Got it stays outside the group so it can be reached.
 */
export function BodyMapHint({ onDismiss }: BodyMapHintProps) {
  return (
    <View className={placementClassName}>
      <View className={boxClassName}>
        <View accessible className="min-w-0 flex-1 flex-row items-center gap-3" role="status">
          <Icon name="Hand" tone="secondary" />
          {/* The design sets this at 14 over 20, which is between the type scale's sizes, as the Toast's words are. */}
          <NativeText className="min-w-0 flex-1 text-[14px] font-normal leading-[20px] tabular-nums text-text-primary">
            {BODY_MAP.coachMark.text}
          </NativeText>
        </View>
        <PressableSurface
          className="h-control-sm justify-center rounded-small px-3"
          hitSlop={dismissHitSlop}
          label={BODY_MAP.coachMark.dismiss}
          onPress={onDismiss}
        >
          <Text tone="accent-ink" variant="label-small">
            {BODY_MAP.coachMark.dismiss}
          </Text>
        </PressableSurface>
      </View>
    </View>
  );
}
