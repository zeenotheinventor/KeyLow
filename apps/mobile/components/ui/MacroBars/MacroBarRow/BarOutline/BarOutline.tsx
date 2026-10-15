import { vars } from "nativewind";
import { View } from "react-native";

import { outlineColour, useTheme } from "../../../../../lib/theme";

import type { BarOutlineProps } from "./types";

/**
 * The over-target outline of a bar (ruling 17): a 1 point gap in the card's surface colour, then a 1.5
 * point ring of the macro colour mixed with white, from 1 to 2.5 points outside the bar. These bars sit
 * on a card, so the gap is the surface colour and not the background colour the compact strip uses. The
 * layers are decoration in a row whose name says the same in words, so they have no role to query by and
 * carry ids instead.
 */
export function BarOutline({ macro }: BarOutlineProps) {
  const { colors } = useTheme();

  return (
    <View aria-hidden className="absolute inset-0" testID={`${macro}-outline`}>
      {/* The ring's colour is the token mixed with white at run time, which no class can name, so it goes through a variable. */}
      <View
        className="absolute -inset-[2.5px] rounded-pill bg-[color:var(--outline-colour)]"
        style={vars({ "--outline-colour": outlineColour(colors[macro]) })}
        testID={`${macro}-outline-colour`}
      />
      <View
        className="absolute -inset-px rounded-pill bg-surface"
        testID={`${macro}-outline-gap`}
      />
    </View>
  );
}
