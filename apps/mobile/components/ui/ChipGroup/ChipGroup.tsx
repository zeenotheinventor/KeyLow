import { vars } from "nativewind";
import { ScrollView, Text as NativeText } from "react-native";

import { useCappedLineHeight } from "../../../lib/useCappedLineHeight";
import { PressableSurface } from "../PressableSurface";

import type { ChipGroupProps } from "./types";

// The body's own line height, and how far its font may grow at large text. The chip is a fixed 36 points.
const labelLineHeight = 24;
const maxFontScale = 1.2;

// The classes are written out so Tailwind sees them. The chosen chip is filled with the accent, written on
// in the accent foreground and set one weight heavier, as the board draws it. Its border is the fill's own
// colour, so both kinds of chip are the same size.
const chipLooks = {
  chosen: {
    chipClassName: "border-accent bg-accent",
    labelClassName: "font-semibold text-accent-foreground",
  },
  other: {
    chipClassName: "border-border bg-surface-raised",
    labelClassName: "font-normal text-text-primary",
  },
} as const;

/**
 * One of a few options, chosen by pressing its chip. The chips sit in a row that scrolls sideways, so a
 * long label such as "1 medium (100 g)" is shown whole instead of being cut or wrapped. The screen builds
 * the options and keeps the choice. The choice changes at once and plays the selection haptic.
 *
 * The group is 44 points tall: the 36 point chips are centred in it with 4 points above and below, which
 * is their touch target. The row clips, so the room has to be padding inside it and not hit slop. A screen
 * that wants the board's 36 point rhythm can give the group `-my-1`.
 */
export function ChipGroup<Value extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: ChipGroupProps<Value>) {
  const lineHeight = useCappedLineHeight(labelLineHeight, maxFontScale);

  return (
    <ScrollView
      aria-label={label}
      className={`grow-0 ${className}`}
      contentContainerClassName="gap-2 py-1"
      horizontal
      role="radiogroup"
      showsHorizontalScrollIndicator={false}
    >
      {options.map((option) => {
        const isChosen = option.value === value;
        const look = chipLooks[isChosen ? "chosen" : "other"];

        return (
          <PressableSurface
            key={option.value}
            checked={isChosen}
            className={`h-control-sm shrink-0 items-center justify-center rounded-pill border px-3 ${look.chipClassName}`}
            // Pressing the chosen chip changes nothing, so it plays no haptic and says nothing.
            haptic={isChosen ? undefined : "select"}
            label={option.label}
            role="radio"
            onPress={() => {
              if (!isChosen) {
                onChange(option.value);
              }
            }}
          >
            {/* Capped so the line stays inside the 36 point chip at large text, which a fixed height cannot grow with. The line height is a runtime value no class can name, so it goes through a variable. */}
            <NativeText
              className={`text-body leading-[var(--chip-line)] tabular-nums ${look.labelClassName}`}
              maxFontSizeMultiplier={maxFontScale}
              numberOfLines={1}
              style={vars({ "--chip-line": lineHeight })}
            >
              {option.label}
            </NativeText>
          </PressableSurface>
        );
      })}
    </ScrollView>
  );
}
