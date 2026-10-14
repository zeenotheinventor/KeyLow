import { View } from "react-native";

import { Text } from "../../Text";

import type { MacrosProps } from "./types";

// The values sit beside a colour mark and are never coloured themselves, so the macro colour is a dot
// and the letters stay in a text colour (Q14). The classes are written out so Tailwind sees them.
const macroColumns = [
  { macro: "protein", letter: "P", dotClassName: "bg-protein" },
  { macro: "carbs", letter: "C", dotClassName: "bg-carbs" },
  { macro: "fat", letter: "F", dotClassName: "bg-fat" },
] as const;

/** The protein, carbohydrate and fat line of a food row, in the order the boards draw it. */
export function Macros({ macros, basis }: MacrosProps) {
  return (
    <View className="flex-row items-center gap-[10px]">
      {macroColumns.map(({ macro, letter, dotClassName }) => (
        <View key={macro} className="flex-row items-center gap-1">
          <View className={`h-[6px] w-[6px] rounded-[2px] ${dotClassName}`} />
          <Text tone="secondary" variant="caption">
            {`${macros[macro]} ${letter}`}
          </Text>
        </View>
      ))}
      {basis === undefined ? null : (
        <Text tone="muted" variant="caption">
          {basis}
        </Text>
      )}
    </View>
  );
}
