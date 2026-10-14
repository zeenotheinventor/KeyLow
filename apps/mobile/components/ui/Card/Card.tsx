import { View } from "react-native";

import type { CardLevel, CardPadding, CardProps } from "./types";

// The classes are written out so Tailwind sees them.
const levelClassName: Record<CardLevel, string> = {
  surface: "bg-surface",
  raised: "bg-surface-raised",
};

const paddingClassName: Record<CardPadding, string> = {
  0: "p-0",
  3: "p-3",
  4: "p-4",
};

/**
 * The basic container: a surface with a 1 point border, the large radius and the card elevation, which
 * clips what it holds, as the design system's `Card` does. The elevation is the `elevation-card` class,
 * because NativeWind drops a `shadow-*` class that reads a CSS variable. The design's title and
 * confirmation flourish are not here: no board draws a title, and the flourish waits for the motion
 * moments.
 */
export function Card({ level = "surface", padding = 4, children, ...accessibility }: CardProps) {
  return (
    <View
      className={`overflow-hidden rounded-large border border-border elevation-card ${levelClassName[level]} ${paddingClassName[padding]}`}
      {...accessibility}
    >
      {children}
    </View>
  );
}
