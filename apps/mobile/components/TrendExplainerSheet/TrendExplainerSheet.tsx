import {
  TREND_EXPLAINER,
  TREND_EXPLAINER_BODY_SECTION,
  describeSettlingBanner,
} from "@keylow/core/copy";
import { TREND_SETTLED_OBS } from "@keylow/core/weight";
import { Text as NativeText, View } from "react-native";

import { Banner, BottomSheet, Button, SettlingProgressBar, SheetScrollView, Text } from "../ui";

import type { TrendExplainerSheetProps } from "./types";

// The board's sheet starts 60 points down a 844 point screen. A shorter phone scrolls what does not fit.
const SNAP_POINTS = ["93%"];

// Body fat and lean mass is the sixth section, after Weekly rate and before the footer.
const SECTIONS = [...TREND_EXPLAINER.sections, TREND_EXPLAINER_BODY_SECTION];

/**
 * The sheet that explains the trend weight, as `trend-explainer` draws it: the title with Done on one row,
 * then the six sections and the line that the trend is an estimate. While the trend settles a warning
 * banner with no icon, and a progress bar under its words, says how many of the 7 weigh-ins it has. The
 * title and Done stay put and the rest scrolls.
 */
export function TrendExplainerSheet({
  open,
  onClose,
  settlingObservationCount,
}: TrendExplainerSheetProps) {
  return (
    <BottomSheet
      label={TREND_EXPLAINER.title}
      open={open}
      snapPoints={SNAP_POINTS}
      onClose={onClose}
    >
      {/* The sheet keeps 16 points at its sides and the board 20, so the contents take 4 more. */}
      <View className="flex-1 px-1">
        <View className="flex-row items-center justify-between pb-4">
          <Text role="heading" variant="h2">
            {TREND_EXPLAINER.title}
          </Text>
          {/* The kit button pads 16 and has a 1 point border where the board's Done pads 8 and has none, so a 9 point pull puts its label's edge at the board's. */}
          <Button className="-mr-[9px]" tone="accent-ink" variant="ghost" onPress={onClose}>
            {TREND_EXPLAINER.done}
          </Button>
        </View>
        <SheetScrollView className="flex-1" contentContainerClassName="gap-4 pb-2">
          {settlingObservationCount === undefined ? null : (
            <Banner
              hasIcon={false}
              size="compact"
              title={describeSettlingBanner(settlingObservationCount)}
              variant="review"
            >
              <SettlingProgressBar
                count={settlingObservationCount}
                hasCaption={false}
                label={TREND_EXPLAINER.progressName}
                target={TREND_SETTLED_OBS}
              />
            </Banner>
          )}
          <View className="gap-4">
            {SECTIONS.map((section) => (
              <View key={section.title} className="gap-1">
                <Text role="heading" variant="body-strong">
                  {section.title}
                </Text>
                {/* The board sets the paragraphs at 14 over 21 in the regular weight, which no Text variant has. */}
                <NativeText className="text-[14px] font-normal leading-[21px] tabular-nums text-text-secondary">
                  {section.text}
                </NativeText>
              </View>
            ))}
          </View>
          <Text tone="muted" variant="caption">
            {TREND_EXPLAINER.footer}
          </Text>
        </SheetScrollView>
      </View>
    </BottomSheet>
  );
}
