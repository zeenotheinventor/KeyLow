import { todayPlanOf } from "@keylow/api-client";
import { BODY_MAP, describeBodyFigureLabel, describeDashboardBodyMapCard } from "@keylow/core/copy";
import { TRAINING_PARAMS_V2 } from "@keylow/core/training";
import { View } from "react-native";

import { rowPressScale } from "../../../lib/motion";
import {
  BodyFigure,
  Card,
  HeatLegendStrip,
  Icon,
  PressableSurface,
  Text,
  VolumeLegendStrip,
} from "../../ui";

import type { DashboardBodyMapCardProps } from "./types";
import type { DashboardBodyMap } from "@keylow/api-client";

const FIGURE_WIDTH = 100;
const TITLE_ICON_SIZE = 14;

/** The card's words for the chart it draws: the view, the line of the top three, today and the name. */
function cardWordsOf(bodyMap: DashboardBodyMap) {
  const today = todayPlanOf(bodyMap.today);
  if (bodyMap.scale === "volume") {
    const { mostSetsLine, ...words } = describeDashboardBodyMapCard({
      scale: "volume",
      mostTrained: bodyMap.mostTrained,
      today,
      opensBodyMap: true,
    });
    return { ...words, summaryLine: mostSetsLine };
  }
  const { warmestLine, ...words } = describeDashboardBodyMapCard({
    scale: "heat",
    warmest: bodyMap.warmest,
    today,
    heatWindowDays: TRAINING_PARAMS_V2.heatWindowDays,
    opensBodyMap: true,
  });
  return { ...words, summaryLine: warmestLine };
}

/**
 * The body map on the dashboard as its board draws it: the title and the view with a Body map link and its
 * chevron, the front and back at 100 points with a legend strip beside them, the top three muscles and
 * today's planned day. The Dashboard chart setting picks the chart. Heat, the default, is Actual heat now
 * with the heat legend from Peak to Rested and the three warmest muscles. Weekly volume is the actual sets
 * of the calendar week, Monday to Sunday, with the volume legend from High to Not trained and the three
 * muscles with the most sets. The figure is drawn as the figure setting has it, male unless said. The
 * whole card is one button that opens the body map, as the Today and This week cards open the Diary, named
 * by what it shows and "Open the body map". There is no toggle and no long-press here. The words and
 * figures inside it are hidden from screen readers, because that name already says all of it.
 */
export function DashboardBodyMapCard({ bodyMap, body, onOpen }: DashboardBodyMapCardProps) {
  const { viewLine, summaryLine, todayLine, accessibleName } = cardWordsOf(bodyMap);
  const figureLabel = (side: "front" | "back") =>
    describeBodyFigureLabel({ scale: bodyMap.scale, view: "actual", side, hint: null });

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
                <Text variant="body-strong">{viewLine}</Text>
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
              scale={bodyMap.scale}
              side="front"
              values={bodyMap.values}
              w={FIGURE_WIDTH}
            />
            <BodyFigure
              body={body}
              label={figureLabel("back")}
              scale={bodyMap.scale}
              side="back"
              values={bodyMap.values}
              w={FIGURE_WIDTH}
            />
            {bodyMap.scale === "volume" ? <VolumeLegendStrip /> : <HeatLegendStrip />}
          </View>
          <View className="flex-row items-baseline justify-between gap-3 border-t border-border pt-2">
            <Text className="flex-1" tone="secondary" variant="caption">
              {summaryLine}
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
