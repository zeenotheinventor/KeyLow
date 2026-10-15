import { useEffect, useRef } from "react";
import { Pressable, ScrollView } from "react-native";

import { Text } from "../../Text";

import type { TimeWheelProps } from "./types";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

// The board's rows are 44 high, and the wheel shows five of them: the chosen row, two above and two below.
const rowHeight = 44;

// The classes are written out so Tailwind sees them. The chosen row sits on accent-muted in the accent ink.
// Its neighbours fade to 80 percent and the rest to 50.
const chosenLook = { rowClassName: "bg-accent-muted opacity-100", tone: "accent-ink" } as const;
const neighbourLook = { rowClassName: "opacity-80", tone: "secondary" } as const;
const farLook = { rowClassName: "opacity-50", tone: "secondary" } as const;

function lookOf(row: number, chosenRow: number) {
  const distance = Math.abs(row - chosenRow);
  return distance === 0 ? chosenLook : distance === 1 ? neighbourLook : farLook;
}

// A two digit label, "05", which is what the row shows and what its option is named.
const twoDigits = (row: number) => String(row).padStart(2, "0");

/**
 * One wheel of the time picker: a column of rows that scrolls and snaps to a row, or is adjusted a step at a
 * time by a screen reader. It is one spin button named for what it sets, with the chosen row as its value
 * (React Native has no listbox role), over a column of options of which the chosen one is selected. The
 * increment and decrement actions step by one and wrap round at the ends, because a clock does.
 */
export function TimeWheel({ label, count, value, onChange }: TimeWheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const valueRef = useRef(value);

  // The handlers read the latest value, which a scroll or an action reports after the render that made them.
  useEffect(() => {
    valueRef.current = value;
  });

  function choose(row: number) {
    scrollRef.current?.scrollTo({ y: row * rowHeight, animated: true });
    onChange(row);
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const row = Math.min(
      count - 1,
      Math.max(0, Math.round(event.nativeEvent.contentOffset.y / rowHeight)),
    );
    if (row !== valueRef.current) {
      onChange(row);
    }
  }

  return (
    <ScrollView
      ref={scrollRef}
      accessible
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      aria-label={label}
      aria-valuemax={count - 1}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={twoDigits(value)}
      className="h-[220px] w-[96px] grow-0"
      contentContainerClassName="py-[88px]"
      decelerationRate="fast"
      role="spinbutton"
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      snapToInterval={rowHeight}
      onAccessibilityAction={(event) => {
        const step = event.nativeEvent.actionName === "increment" ? 1 : -1;
        choose((valueRef.current + step + count) % count);
      }}
      // The wheel starts on the chosen row, which the scroll view does not know until it has a size.
      onLayout={() => {
        scrollRef.current?.scrollTo({ y: valueRef.current * rowHeight, animated: false });
      }}
      onScroll={handleScroll}
    >
      {Array.from({ length: count }, (_, row) => {
        const look = lookOf(row, value);

        return (
          <Pressable
            key={row}
            aria-selected={row === value}
            className={`h-[44px] items-center justify-center rounded-medium ${look.rowClassName}`}
            role="option"
            onPress={() => {
              choose(row);
            }}
          >
            <Text tone={look.tone} variant="h2">
              {twoDigits(row)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
