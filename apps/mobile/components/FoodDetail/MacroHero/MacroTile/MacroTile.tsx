import { NOT_GIVEN, describeShareOfEnergy } from "@keylow/core/copy";
import { formatEnergyShare, formatGrams } from "@keylow/core/format";
import { View } from "react-native";

import { Badge, Text } from "../../../ui";

import type { MacroTileMacro, MacroTileProps } from "./types";

// The classes are written out so Tailwind sees them.
const dotClassName: Record<MacroTileMacro, string> = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
};

function describeTile({ label, grams, share }: Pick<MacroTileProps, "label" | "grams" | "share">) {
  if (grams === null) {
    return `${label}, ${NOT_GIVEN}`;
  }
  const amount = `${label}, ${formatGrams(grams)} g`;
  return share === null ? amount : `${amount}, ${describeShareOfEnergy(share)}`;
}

/** One macro of the energy card: its colour and name, its grams and, when it can be worked out, its share of the energy. */
export function MacroTile({ label, macro, grams, share }: MacroTileProps) {
  return (
    <View
      accessible
      aria-label={describeTile({ label, grams, share })}
      className="min-w-0 flex-1 gap-1 rounded-medium bg-surface-raised px-3 py-[10px]"
    >
      <View className="flex-row items-center gap-[6px]">
        <View aria-hidden className={`h-2 w-2 rounded-[2px] ${dotClassName[macro]}`} />
        <Text tone="secondary" variant="caption">
          {label}
        </Text>
      </View>
      {grams === null ? (
        <Text tone="muted">{NOT_GIVEN}</Text>
      ) : (
        <>
          <View className="flex-row items-baseline gap-[3px]">
            <Text variant="numeral-small">{formatGrams(grams)}</Text>
            <Text tone="muted" variant="caption">
              g
            </Text>
          </View>
          {share === null ? null : <Badge outlined>{formatEnergyShare(share)}</Badge>}
        </>
      )}
    </View>
  );
}
