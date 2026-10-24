import { vars } from "nativewind";
import { View } from "react-native";

import { Text } from "../Text";
import { describeCountOfTarget } from "./describeCountOfTarget";

import type { SettlingProgressBarProps } from "./types";

/**
 * A count towards a target, as the trend-explainer and programme boards draw it inside the warning banner: the
 * label with "4 of 8" over a 6 point track on the raised surface with a warning fill. The caption can be left
 * out, for a banner whose own words already say the count. The track is the progress bar, named by the label and
 * the count, so the caption is left to it and hidden from screen readers.
 */
export function SettlingProgressBar({
  label,
  name,
  count,
  target,
  hasCaption = true,
}: SettlingProgressBarProps) {
  // More than the target holds the bar full, and less than nothing holds it empty.
  const countShown = Math.min(Math.max(count, 0), target);
  const countText = describeCountOfTarget(countShown, target);
  const fill = target > 0 ? (countShown / target) * 100 : 0;

  return (
    <View className="gap-[6px]">
      {hasCaption && (
        <View aria-hidden className="flex-row justify-between gap-2">
          <Text variant="caption">{label}</Text>
          <Text className="tabular-nums" tone="secondary" variant="caption">
            {countText}
          </Text>
        </View>
      )}
      <View
        accessible
        aria-label={hasCaption ? `${name ?? label}, ${countText}` : (name ?? label)}
        aria-valuemax={target}
        aria-valuemin={0}
        aria-valuenow={countShown}
        className="h-[6px] overflow-hidden rounded-pill bg-surface-raised"
        role="progressbar"
      >
        {/* The fill's share of its track is a runtime number no class can name, so it goes through a variable. */}
        <View
          className="h-full w-[var(--settling-fill)] bg-warning"
          style={vars({ "--settling-fill": `${fill}%` })}
        />
      </View>
    </View>
  );
}
