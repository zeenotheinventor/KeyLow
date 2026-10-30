import { todayPlanOf } from "@keylow/api-client";
import { BODY_MAP, describeBodyFigureLabel, describeDashboardBodyMapCard } from "@keylow/core/copy";
import { TRAINING_PARAMS_V2 } from "@keylow/core/training";
import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import { BodyFigure, Card, HeatLegendStrip, Icon, PressableSurface, Text } from "../../ui";

import type { DashboardBodyMapCardProps } from "./types";

const FIGURE_WIDTH = 100;
const TITLE_ICON_SIZE = 14;

/**
 * The body map on the dashboard as its board draws it: the title and the view with a Body map link and its
 * chevron, Actual heat now, front and back at 100 points, the heat legend from Peak to Rested, the three
 * warmest muscles and today's planned day. The figure is drawn as the figure setting has it, male unless said. The
 * whole card is one button that opens the body map, as the Today and This week cards open the Diary, named
 * by what it shows and "Open the body map". There is no toggle and no long-press here. The words and
 * figures inside it are hidden from screen readers, because that name already says all of it.
 */
export function DashboardBodyMapCard({ bodyMap, body, onOpen }: DashboardBodyMapCardProps) {
  const { warmestLine, todayLine, accessibleName } = describeDashboardBodyMapCard({
    warmest: bodyMap.warmest,
    today: todayPlanOf(bodyMap.today),
    heatWindowDays: TRAINING_PARAMS_V2.heatWindowDays,
    opensBodyMap: true,
  });
  const figureLabel = (side: "front" | "back") =>
    describeBodyFigureLabel({ scale: "heat", view: "actual", side, hint: null });

  return (
    <Card padding={0}>
      <PressableSurface
        className="py-3 pl-4 pr-3"
        label={accessibleName}
        pressScale={rowPressScale}
        onPress={onOpen}
      >
        <View aria-hidden className="gap-2">
          <View className="flex-row items-start justify-between gap-2">
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
            <View className="min-h-touch-target flex-row items-center gap-[2px]">
              <Text variant="label-small">{BODY_MAP.dashboardCard.link}</Text>
              <Icon name="ChevronRight" size="sm" tone="secondary" />
            </View>
          </View>
          <View className="flex-row items-end justify-center gap-[28px]">
            <BodyFigure
              body={body}
              label={figureLabel("front")}
              scale="heat"
              side="front"
              values={bodyMap.values}
              w={FIGURE_WIDTH}
            />
            <BodyFigure
              body={body}
              label={figureLabel("back")}
              scale="heat"
              side="back"
              values={bodyMap.values}
              w={FIGURE_WIDTH}
            />
            <HeatLegendStrip />
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
      </PressableSurface>
    </Card>
  );
}
