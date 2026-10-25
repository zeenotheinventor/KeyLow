import { vars } from "nativewind";
import { ScrollView, Text as NativeText, View } from "react-native";

import { useCappedLineHeight } from "../../../lib/useCappedLineHeight";
import { PressableSurface } from "../PressableSurface";

import type { ChipGroupClearableProps, ChipGroupMultipleProps, ChipGroupProps } from "./types";

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

// One choice has the radios of a radio group. Several are checkboxes in a plain group.
const selectionRoles = {
  single: { group: "radiogroup", chip: "radio" },
  multiple: { group: "group", chip: "checkbox" },
} as const;

// The scroll layout reaches the 44 point touch target with padding inside its clipping row. The wrap layout
// clips nothing, so each 36 point chip takes the 4 points above and below as hit slop. The lines are 8
// points apart, so the slops of two lines meet and never overlap.
const wrapChipHitSlop = { top: 4, bottom: 4 };

type ChipGroupAnyProps<Value extends string> =
  ChipGroupProps<Value> | ChipGroupClearableProps<Value> | ChipGroupMultipleProps<Value>;

// The chips of the scroll and wrap layouts are 36 points and as wide as their label. The equal layout's are
// 44 points, the set entry board's, and share the line equally, so a few short labels fill it.
const chipSizeClassName = {
  scroll: "h-control-sm shrink-0 px-3",
  wrap: "h-control-sm shrink-0 px-3",
  equal: "h-control-md px-0",
} as const;

type ChipChoice = { isChosen: boolean; haptic: "select" | undefined; press: () => void };

// What one chip says and does. One choice moves to the pressed chip, and pressing the chosen chip changes
// nothing, so it plays no haptic and says nothing. Several each toggle on their own, the others untouched.
function chipChoice<Value extends string>(
  group: ChipGroupAnyProps<Value>,
  optionValue: Value,
): ChipChoice {
  if (group.selection === "multiple") {
    const isChosen = group.value.includes(optionValue);
    return {
      isChosen,
      haptic: "select",
      press: () => {
        group.onChange(
          isChosen
            ? group.value.filter((chosen) => chosen !== optionValue)
            : [...group.value, optionValue],
        );
      },
    };
  }

  const isChosen = optionValue === group.value;
  if ("allowDeselect" in group) {
    // A clearable group takes the choice back when the chosen chip is pressed again.
    return {
      isChosen,
      haptic: "select",
      press: () => {
        group.onChange(isChosen ? null : optionValue);
      },
    };
  }
  return {
    isChosen,
    haptic: isChosen ? undefined : "select",
    press: () => {
      if (!isChosen) {
        group.onChange(optionValue);
      }
    },
  };
}

/**
 * One of a few options, or any number of them, chosen by pressing a chip. By default the chips sit in a
 * row that scrolls sideways, so a long label such as "1 medium (100 g)" is shown whole instead of being
 * cut or wrapped. With `layout="wrap"` they fall onto as many lines as they need, for short labels such
 * as the equipment a person can use. With `layout="equal"` they share one line in equal columns 44 points
 * high, 6 points apart, for a few very short labels such as RIR 0 to 6+. The screen builds the options and
 * keeps the choice. The choice changes at once and plays the selection haptic. With `allowDeselect` (one
 * choice) pressing the chosen chip again takes the choice back and gives `onChange` null, for a value that
 * is optional.
 *
 * In the scroll layout the group is 44 points tall: the 36 point chips are centred in it with 4 points
 * above and below, which is their touch target. The row clips, so the room has to be padding inside it
 * and not hit slop. A screen that wants the board's 36 point rhythm can give the group `-my-1`. In the wrap
 * layout nothing clips, so the touch target is hit slop and the lines sit the board's 8 points apart.
 *
 * With `selection="multiple"` the group is a plain group of checkboxes and the screen keeps a list of
 * values, to which each press adds the chip or from which it takes it out.
 */
export function ChipGroup<Value extends string>(props: ChipGroupAnyProps<Value>) {
  const { label, options, layout = "scroll", className = "" } = props;
  const roles = selectionRoles[props.selection === "multiple" ? "multiple" : "single"];
  const lineHeight = useCappedLineHeight(labelLineHeight, maxFontScale);

  const chips = options.map((option) => {
    const { isChosen, haptic, press } = chipChoice(props, option.value);
    const look = chipLooks[isChosen ? "chosen" : "other"];

    return (
      <PressableSurface
        key={option.value}
        checked={isChosen}
        className={`${chipSizeClassName[layout]} items-center justify-center rounded-pill border ${look.chipClassName}`}
        haptic={haptic}
        hitSlop={layout === "wrap" ? wrapChipHitSlop : undefined}
        label={option.label}
        role={roles.chip}
        onPress={() => {
          press();
          props.onChipPress?.(option.value);
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
  });

  if (layout === "equal") {
    return (
      <View aria-label={label} className={`flex-row gap-[6px] ${className}`} role={roles.group}>
        {chips.map((chip) => (
          // The press scale wraps each chip, so the equal share has to be taken by a view round that.
          <View key={chip.key} className="min-w-0 flex-1 basis-0">
            {chip}
          </View>
        ))}
      </View>
    );
  }

  if (layout === "wrap") {
    return (
      <View
        aria-label={label}
        className={`flex-row flex-wrap gap-2 ${className}`}
        role={roles.group}
      >
        {chips}
      </View>
    );
  }

  return (
    <ScrollView
      aria-label={label}
      className={`grow-0 ${className}`}
      contentContainerClassName="gap-2 py-1"
      horizontal
      role={roles.group}
      showsHorizontalScrollIndicator={false}
    >
      {chips}
    </ScrollView>
  );
}
