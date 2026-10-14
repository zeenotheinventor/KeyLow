import { vars } from "nativewind";
import { Text as NativeText, View } from "react-native";

import { useCappedLineHeight } from "../../../lib/useCappedLineHeight";
import { PressableSurface } from "../PressableSurface";

import type { SegmentedControlProps } from "./types";

// A segment is 36 points: the 44 point track less its hairline and the 3 points of padding. It reaches
// the 44 point touch target by taking the padding as its hit slop.
const segmentHitSlop = { top: 4, bottom: 4 };

// The label's design line height, and how far its font may grow at large text.
const labelLineHeight = 20;
const maxFontScale = 1.2;

// The classes are written out so Tailwind sees them. The chosen segment is filled with the primary text
// colour and written on in the background colour, as the design system card draws the neutral tone.
const segmentLooks = {
  chosen: { segmentClassName: "bg-text-primary", labelClassName: "text-background" },
  other: { segmentClassName: "", labelClassName: "text-text-secondary" },
};

/**
 * One of two to five short options, chosen by pressing it. The choice changes at once and plays the
 * selection haptic. The design's highlight slides to the new segment with a skew, which waits for a
 * motion review on a device, so here the chosen segment is filled where it stands.
 */
export function SegmentedControl<Value extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<Value>) {
  const lineHeight = useCappedLineHeight(labelLineHeight, maxFontScale);

  return (
    <View
      aria-label={label}
      className="h-control-md flex-row rounded-medium border border-border bg-surface-raised p-[3px]"
      role="radiogroup"
    >
      {options.map((option) => {
        const isChosen = option.value === value;
        const look = segmentLooks[isChosen ? "chosen" : "other"];

        return (
          <View key={option.value} className="flex-1">
            <PressableSurface
              checked={isChosen}
              // Pressing the chosen option changes nothing, so it plays no haptic and says nothing.
              className={`h-control-sm items-center justify-center overflow-hidden rounded-[9px] px-2 ${look.segmentClassName}`}
              haptic={isChosen ? undefined : "select"}
              hitSlop={segmentHitSlop}
              label={option.label}
              role="radio"
              onPress={() => {
                if (!isChosen) {
                  onChange(option.value);
                }
              }}
            >
              {/* The design sets this at 14 over 20, which is between the type scale's sizes, so it is not a Text variant. One line, growing no more than 1.2 times at large text, because a segment has only its share of the track. The line height is a runtime value no class can name, so it goes through a variable. */}
              <NativeText
                className={`text-[14px] font-semibold leading-[var(--segment-label-line)] tabular-nums ${look.labelClassName}`}
                maxFontSizeMultiplier={maxFontScale}
                numberOfLines={1}
                style={vars({ "--segment-label-line": lineHeight })}
              >
                {option.label}
              </NativeText>
            </PressableSurface>
          </View>
        );
      })}
    </View>
  );
}
