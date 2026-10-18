import { BODY_MAP, describeBodyFigureLabel, describeDashboardBodyMapCard } from "@keylow/core/copy";
import { TRAINING_PARAMS_V1 } from "@keylow/core/training";
import { View } from "react-native";

import { todayPlanOf } from "./todayPlanOf";
import { BodyFigure, Card, Icon, Text } from "../../ui";

import type { DashboardBodyMapCardProps } from "./types";

const FIGURE_WIDTH = 100;
const TITLE_ICON_SIZE = 14;

// The legend reads from the hottest step down to the rested one, as the board draws it, and only the peak
// glows. The classes are written out so Tailwind sees them.
const heatSwatchClassNames = [
  "bg-heat-5 shadow-[0_0_6px_0] shadow-heat-glow",
  "bg-heat-4",
  "bg-heat-3",
  "bg-heat-2",
  "bg-heat-1",
  "bg-heat-0",
];

/**
 * The body map on the dashboard as its board draws it: Actual heat now, front and back at 100 points, the
 * heat legend from Peak to Rested, the three warmest muscles and today's planned day. The figure is drawn
 * male until the figure setting exists. It is information for now and not a link, because the body map screen
 * it will open does not exist yet, so it has no button and its name leaves out "Open the body map". The
 * whole card is one element with that name and no role, and the words and figures inside it are hidden from screen
 * readers because the name already says all of it.
 */
export function DashboardBodyMapCard({ bodyMap }: DashboardBodyMapCardProps) {
  const { warmestLine, todayLine, accessibleName } = describeDashboardBodyMapCard({
    warmest: bodyMap.warmest,
    today: todayPlanOf(bodyMap.today),
    heatWindowDays: TRAINING_PARAMS_V1.heatWindowDays,
    opensBodyMap: false,
  });
  const figureLabel = (side: "front" | "back") =>
    describeBodyFigureLabel({ scale: "heat", view: "actual", side, hint: null });

  return (
    <Card padding={0}>
      <View accessible aria-label={accessibleName} className="py-3 pl-4 pr-3">
        <View aria-hidden className="gap-2">
          <View className="gap-[2px]">
            <View className="flex-row items-center gap-[6px]">
              <Icon name="Dumbbell" size={TITLE_ICON_SIZE} tone="secondary" />
              <Text tone="muted" variant="caption">
                {BODY_MAP.dashboardCard.title}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-text-primary" />
              <Text variant="body-strong">{BODY_MAP.dashboardCard.view}</Text>
            </View>
          </View>
          <View className="flex-row items-end justify-center gap-[28px]">
            <BodyFigure
              label={figureLabel("front")}
              scale="heat"
              side="front"
              values={bodyMap.values}
              w={FIGURE_WIDTH}
            />
            <BodyFigure
              label={figureLabel("back")}
              scale="heat"
              side="back"
              values={bodyMap.values}
              w={FIGURE_WIDTH}
            />
            <View
              accessible
              aria-label={BODY_MAP.legendNames.heat}
              className="items-start gap-[3px] pb-[6px]"
              role="img"
            >
              <Text tone="muted" variant="caption">
                {BODY_MAP.dashboardCard.hottestStep}
              </Text>
              {heatSwatchClassNames.map((swatchClassName) => (
                <View
                  key={swatchClassName}
                  className={`h-[14px] w-[10px] rounded-[3px] ${swatchClassName}`}
                />
              ))}
              <Text tone="muted" variant="caption">
                {BODY_MAP.dashboardCard.coolestStep}
              </Text>
            </View>
          </View>
          <View className="flex-row items-baseline justify-between gap-3 border-t border-border pt-2">
            <Text className="flex-1" tone="secondary" variant="caption">
              {warmestLine}
            </Text>
            {todayLine === null ? null : (
              <Text className="shrink-0" tone="muted" variant="caption">
                {todayLine}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
}
