import {
  MEAL_PLAN_BAND_NAMES,
  MEAL_PLAN_WORDS,
  describePlanDayFigures,
  describePlanDayTitle,
} from "@keylow/core/copy";
import { PLAN_STATUS_BADGE } from "@keylow/core/plans";
import { View } from "react-native";

import { Badge, Icon, PressableSurface, Text } from "../../ui";

import type { PlanDayCardProps } from "./types";

/**
 * One day of the week on the Plan screen (`plan · week`): the day, its figures against that day's own target, a
 * status badge, and a line for each band naming what is planned. The whole card opens the day. A short day's
 * figures are in the warning ink, as the board draws them.
 */
export function PlanDayCard({ view, isToday, onPress }: PlanDayCardProps) {
  const badge = PLAN_STATUS_BADGE[view.status];
  const figures = describePlanDayFigures(view.totals, view.target);
  const title = describePlanDayTitle(view.localDate);

  return (
    <PressableSurface
      className="gap-3 rounded-large border border-border bg-surface p-4"
      label={[
        title,
        ...(isToday ? [MEAL_PLAN_WORDS.today] : []),
        badge.label,
        figures,
        ...view.bands.map(({ band, line }) => `${MEAL_PLAN_BAND_NAMES[band]} ${line}`),
      ].join(", ")}
      onPress={onPress}
    >
      <View className="flex-row items-start gap-3">
        <View className="min-w-0 flex-1 gap-[2px]">
          <Text variant="body-strong">
            {title}
            {isToday ? (
              <Text tone="accent-ink" variant="caption">{` · ${MEAL_PLAN_WORDS.today}`}</Text>
            ) : null}
          </Text>
          <Text tone={view.status === "short" ? "warning-ink" : "secondary"} variant="caption">
            {figures}
          </Text>
        </View>
        <Badge
          dot={view.status === "confirmed" || view.status === "short"}
          outlined={view.status === "within" || view.status === "empty"}
          tone={badge.tone}
        >
          {badge.label}
        </Badge>
        <Icon name="ChevronRight" size="sm" tone="muted" />
      </View>
      <View className="gap-1">
        {view.bands.map(({ band, line, items }) => (
          <View key={band} className="flex-row items-baseline gap-3">
            <Text className="w-[64px]" tone="muted" variant="caption">
              {MEAL_PLAN_BAND_NAMES[band]}
            </Text>
            <Text className="min-w-0 flex-1" variant="caption">
              {line}
            </Text>
            {items.map(({ id, badge: itemBadge }) =>
              itemBadge === null ? null : (
                <Badge key={id} outlined>
                  {itemBadge}
                </Badge>
              ),
            )}
          </View>
        ))}
      </View>
    </PressableSurface>
  );
}
