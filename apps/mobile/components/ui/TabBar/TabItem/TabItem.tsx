import { vars } from "nativewind";
import { Text as NativeText, View } from "react-native";

import { PillFill } from "./PillFill";
import { useLabelLineHeight } from "./useLabelLineHeight";
import { useTheme } from "../../../../lib/theme";
import { Icon } from "../../Icon";
import { PressableSurface } from "../../PressableSurface";

import type { TabItemProps } from "./types";
import type { TabBarPlatform } from "../types";

// The classes are written out so Tailwind sees them. The iOS bar is 49 points counting its hairline, so
// its slots are 48. The label is 10 on iOS and 12 on Android, which are off the type scale, so they are
// sizes and not scale classes, and both sit in a 12 point line.
const looks: Record<TabBarPlatform, { itemClassName: string; labelSizeClassName: string }> = {
  ios: {
    itemClassName: "h-[48px] gap-[2px]",
    labelSizeClassName: "text-[10px] leading-[var(--tab-label-line)]",
  },
  android: {
    itemClassName: "h-[64px] gap-1",
    labelSizeClassName: "text-[12px] leading-[var(--tab-label-line)]",
  },
};

/** One destination: an icon over its label, a tab that says whether it is the selected one. */
export function TabItem({ tab, isActive, platform, onSelect }: TabItemProps) {
  const { scheme } = useTheme();
  const labelLineHeight = useLabelLineHeight();
  const look = looks[platform];

  // The accent is lime, which is too faint for text or a thin glyph on a light surface. Selected is
  // `accent-ink`: lime in dark and the primary text colour in light. On Android the label stays the
  // primary text colour, and the icon takes the ink on its pill.
  const activeLabelClassName =
    platform === "android" || scheme === "light" ? "text-text-primary" : "text-accent";
  const labelClassName = isActive
    ? `${activeLabelClassName} font-semibold`
    : "text-text-muted font-medium";
  const iconTone = isActive ? "accent-ink" : "muted";

  return (
    <View className="flex-1">
      <PressableSurface
        className={`items-center justify-center ${look.itemClassName}`}
        // Selecting a destination is a selection, so it plays the selection haptic. Pressing the one
        // already selected changes nothing, so it plays none.
        haptic={isActive ? undefined : "select"}
        label={tab.label}
        role="tab"
        selected={isActive}
        onPress={() => {
          onSelect(tab.key);
        }}
      >
        {platform === "android" ? (
          <View className="h-[28px] w-[56px] items-center justify-center">
            <PillFill isActive={isActive} />
            <Icon name={tab.icon} size="lg" tone={iconTone} />
          </View>
        ) : (
          <Icon name={tab.icon} size="lg" tone={iconTone} />
        )}
        {/*
          One line, growing no more than 1.2 times at large text, as native tab bars cap their labels: a
          label has only its slot to live in. At 1.2 "Dashboard" still fits a 78 point slot, and a longer
          label ends in an ellipsis. The line height is a runtime value no class can name, because it
          follows the font scale, so it goes through a variable, as the bar's inset does.
        */}
        <NativeText
          className={`${look.labelSizeClassName} ${labelClassName}`}
          maxFontSizeMultiplier={1.2}
          numberOfLines={1}
          style={vars({ "--tab-label-line": labelLineHeight })}
        >
          {tab.label}
        </NativeText>
      </PressableSurface>
    </View>
  );
}
