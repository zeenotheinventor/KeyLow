import { MACRO_NAMES, describeProgressTarget } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";
import { vars } from "nativewind";
import { View } from "react-native";

import { useTheme } from "../../../lib/theme";
import { Icon } from "../Icon";
import { Text } from "../Text";
import { outlineColour } from "./outlineColour";

import type { ProgressBar, ProgressBarKey } from "@keylow/core/diary";

// The classes are written out so Tailwind sees them. The calories column is one and a half times a macro
// column.
const columnClassName: Record<ProgressBarKey, string> = {
  calories: "flex-[1.5]",
  protein: "flex-1",
  carbs: "flex-1",
  fat: "flex-1",
};
const fillClassName: Record<ProgressBarKey, string> = {
  calories: "bg-calories",
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
};

// The captions grow with large text, but no more than the day pill's do, so "C 129 / 220" stays on its line in a column a quarter of the strip wide.
const maxFontScale = 1.2;

/** One column: the line of numbers, and under it a 4 point bar when there is a target. */
export function ProgressColumn({ bar }: { bar: ProgressBar }) {
  const format = bar.key === "calories" ? formatCalories : formatGrams;

  return (
    <View className={`min-w-0 gap-[6px] ${columnClassName[bar.key]}`} testID={`${bar.key}-column`}>
      <View className="flex-row items-center gap-1">
        {bar.key === "calories" ? (
          <Icon name="Flame" size={12} strokeWidth={2} tone="calories" />
        ) : (
          <Text
            maxFontSizeMultiplier={maxFontScale}
            numberOfLines={1}
            tone="secondary"
            variant="caption"
          >
            {MACRO_NAMES[bar.key].charAt(0)}
          </Text>
        )}
        <Text maxFontSizeMultiplier={maxFontScale} numberOfLines={1} variant="caption">
          {format(bar.eaten)}
        </Text>
        <Text maxFontSizeMultiplier={maxFontScale} numberOfLines={1} tone="muted" variant="caption">
          {describeProgressTarget(bar)}
        </Text>
      </View>
      {bar.hasTarget && <ProgressBarTrack bar={bar} />}
    </View>
  );
}

// The layers, the fill and the outline are decoration inside one button whose name says the same in
// words, so they have no role to query by and carry ids instead.
function ProgressBarTrack({ bar }: { bar: ProgressBar }) {
  const { colors } = useTheme();

  return (
    <View className="h-1">
      {bar.isOver && (
        // A 1 point gap in the background colour, then a 1.5 point ring: from 1 to 2.5 points outside the bar.
        <View aria-hidden className="absolute inset-0" testID={`${bar.key}-outline`}>
          {/* The ring's colour is the token mixed with white at run time, which no class can name, so it goes through a variable. */}
          <View
            className="absolute -inset-[2.5px] rounded-pill bg-[color:var(--outline-colour)]"
            style={vars({ "--outline-colour": outlineColour(colors[bar.key]) })}
            testID={`${bar.key}-outline-colour`}
          />
          <View
            className="absolute -inset-px rounded-pill bg-background"
            testID={`${bar.key}-outline-gap`}
          />
        </View>
      )}
      <View className="h-full overflow-hidden rounded-pill bg-border">
        {/* The fill's share of its track is a runtime number no class can name, so it goes through a variable. */}
        <View
          className={`h-full w-[var(--progress-fill)] ${fillClassName[bar.key]}`}
          style={vars({ "--progress-fill": `${bar.fillFraction * 100}%` })}
          testID={`${bar.key}-fill`}
        />
      </View>
    </View>
  );
}
