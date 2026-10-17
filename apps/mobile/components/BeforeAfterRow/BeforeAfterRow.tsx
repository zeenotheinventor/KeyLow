import { REFRESH } from "@keylow/core/copy";
import { View } from "react-native";

import { Icon, Text } from "../ui";

import type { BeforeAfterMarker, BeforeAfterRowProps } from "./types";

// The classes are written out so Tailwind sees them.
const markerClassName: Record<BeforeAfterMarker, string> = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
  none: "",
};

const sizeClassName = { regular: "min-h-[40px]", compact: "min-h-[32px]", plain: "" };

/**
 * One figure of the refresh screen, before and after: the label with its macro's colour square, the old
 * value in secondary text, an arrow, and the new value in strong text with the unit once. A figure that did
 * not change is written once with "no change" after it. The row is one stop for a screen reader, which hears
 * the figure as core words it.
 */
export function BeforeAfterRow({
  label,
  figures,
  marker,
  size = "regular",
  hasDivider = false,
}: BeforeAfterRowProps) {
  return (
    <View
      accessible
      aria-label={figures.accessibleName}
      className={`${sizeClassName[size]} flex-row items-center gap-2 ${hasDivider ? "border-t border-border" : ""}`}
      role="group"
    >
      {label === undefined ? null : (
        <View className="flex-1 flex-row items-center gap-[6px]">
          {marker === undefined ? null : (
            <View aria-hidden className={`h-2 w-2 rounded-[2px] ${markerClassName[marker]}`} />
          )}
          <Text>{label}</Text>
        </View>
      )}
      {figures.isUnchanged ? (
        <View className="flex-row items-baseline gap-[6px]">
          <Text variant="body-strong">{figures.after}</Text>
          <Text tone="muted" variant="caption">
            {REFRESH.noChange}
          </Text>
        </View>
      ) : (
        <View className="flex-row items-center gap-[6px]">
          <Text tone="secondary">{figures.before}</Text>
          <Icon name="ArrowRight" size="sm" tone="muted" />
          <Text variant="body-strong">{figures.after}</Text>
        </View>
      )}
    </View>
  );
}
