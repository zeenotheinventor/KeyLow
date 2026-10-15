import { View } from "react-native";

import { MacroBarRow } from "./MacroBarRow";

import type { MacroBarsProps } from "./types";

/**
 * Protein, carbs and fat against their targets. Each row is named in words (never colour alone) and
 * prints the grams eaten over the target. Past a target the fill completes and gains an outline of its
 * own colour mixed with white (ruling 17), and the delta is printed in the primary text colour: no
 * warning colour. With no target the bar stays empty and only the grams show. The fills whip in one
 * after another.
 */
export function MacroBars({ protein, carbs, fat, compact = false }: MacroBarsProps) {
  return (
    <View className={compact ? "gap-2" : "gap-3"}>
      <MacroBarRow compact={compact} index={0} macro="protein" {...protein} />
      <MacroBarRow compact={compact} index={1} macro="carbs" {...carbs} />
      <MacroBarRow compact={compact} index={2} macro="fat" {...fat} />
    </View>
  );
}
