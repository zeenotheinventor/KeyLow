import { View } from "react-native";

import { Icon } from "../../Icon";
import { Text } from "../../Text";

import type { FitLineProps } from "./types";

const glyphs = { success: "CircleCheck", warning: "TriangleAlert" } as const;

/**
 * The raised strip under the figures that says whether the recipe came within what was asked: a 16 point glyph,
 * success or warning, and the words in the secondary caption.
 */
export function FitLine({ text, tone }: FitLineProps) {
  return (
    <View className="flex-row items-start gap-2 border-t border-border bg-surface-raised px-3 py-[10px]">
      <Icon name={glyphs[tone]} size="sm" tone={tone} />
      <Text className="min-w-0 flex-1" tone="secondary" variant="caption">
        {text}
      </Text>
    </View>
  );
}
