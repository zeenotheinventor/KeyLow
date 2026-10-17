import {
  WEEK_CARD,
  describeDaysComplete,
  describeThisWeekCard,
  describeWeekGridTitle,
  describeWeekStripName,
} from "@keylow/core/copy";
import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { Card, Icon, PressableSurface, Text } from "../../ui";
import { DayMarkers } from "../DayMarkers";
import { WeekAverageBar } from "../WeekAverageBar";

import type { ThisWeekCardProps } from "./types";

/**
 * The week so far as the dashboard board draws it: the title with a chevron and the week's Monday, the
 * average calories against the target, the seven day markers and the days complete. The whole card is
 * one button that opens the Diary on today, as the Today card is, named by the title, the average and the
 * days complete. The words inside it are hidden from screen readers, because that name already says all
 * of it.
 */
export function ThisWeekCard({ summary, onOpenDiary }: ThisWeekCardProps) {
  return (
    <Card padding={0}>
      <PressableSurface
        className="p-4"
        label={describeThisWeekCard(summary, "diary")}
        pressScale={rowPressScale}
        onPress={onOpenDiary}
      >
        <View aria-hidden className="gap-3">
          <View className="gap-[2px]">
            <View className="flex-row items-center gap-2">
              <Text className="flex-1" variant="h2">
                {describeWeekStripName(summary.weekStart, true)}
              </Text>
              <Icon name="ChevronRight" size="sm" tone="muted" />
            </View>
            <Text tone="muted" variant="caption">
              {describeWeekGridTitle(summary.weekStart)}
            </Text>
          </View>
          {summary.averageKcal === null ? (
            <Text tone="secondary">{WEEK_CARD.nothingLogged}</Text>
          ) : (
            <WeekAverageBar
              averageKcal={summary.averageKcal}
              barFill={summary.barFill}
              daysLogged={summary.daysLogged}
              kcalOverTarget={summary.kcalOverTarget}
              targetKcal={summary.targetKcal}
            />
          )}
          <View className="h-px bg-border" />
          <View className="gap-2">
            <DayMarkers markers={summary.markers} />
            <Text variant="body-strong">
              {describeDaysComplete(summary.daysComplete, summary.daysSoFar)}
            </Text>
          </View>
        </View>
      </PressableSurface>
    </Card>
  );
}
