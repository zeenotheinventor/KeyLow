import { todayPlanOf } from "@keylow/api-client";
import { BODY_MAP, describeBodyFigureLabel, describeDashboardBodyMapCard } from "@keylow/core/copy";
import { TRAINING_PARAMS_V2 } from "@keylow/core/training";
import { iconStroke } from "@keylow/tokens";
import { Dumbbell } from "lucide-react";

import type { DashboardBodyMapCardProps } from "./types";

import { BodyFigure } from "@/components/ui/BodyFigure";
import { Card } from "@/components/ui/Card";
import { HeatLegendStrip } from "@/components/ui/HeatLegendStrip";

const FIGURE_WIDTH = 100;

const figureLabel = (side: "front" | "back") =>
  describeBodyFigureLabel({ scale: "heat", view: "actual", side, hint: null });

/**
 * The body map on the dashboard as its board draws it: the title and the view, Actual heat now, front and
 * back at 100 pixels, the heat legend from Peak to Rested, the three warmest muscles and today's planned
 * day. The board's Body map label and chevron are left out until the card is a link (the web body map
 * screen ticket brings them back with it). The figure is drawn male until the figure setting
 * reaches the web. There is no toggle and no click on the figures. The card is not yet a link, because
 * the web body map screen does not exist, so it is named by what it shows alone. The section is labelled by
 * the short title, and inside it one image carries that name, so the words and figures within are
 * presentational: the name already says all of it.
 */
export function DashboardBodyMapCard({ bodyMap }: DashboardBodyMapCardProps) {
  const { warmestLine, todayLine, accessibleName } = describeDashboardBodyMapCard({
    warmest: bodyMap.warmest,
    today: todayPlanOf(bodyMap.today),
    heatWindowDays: TRAINING_PARAMS_V2.heatWindowDays,
    opensBodyMap: false,
  });

  return (
    <Card asChild padding="none">
      <section aria-label={BODY_MAP.dashboardCard.title}>
        <div role="img" aria-label={accessibleName} className="flex flex-col gap-2 py-3 pl-4 pr-3">
          <div className="flex flex-col gap-0.5">
            <p className="flex items-center gap-1.5 text-caption text-text-muted">
              <Dumbbell
                className="size-[14px] shrink-0 text-text-secondary"
                strokeWidth={iconStroke}
              />
              {BODY_MAP.dashboardCard.title}
            </p>
            <p className="flex items-center gap-2 text-body-strong">
              <span className="size-2 shrink-0 rounded-full bg-text-primary" />
              {BODY_MAP.dashboardCard.view}
            </p>
          </div>
          <div className="flex items-end justify-center gap-7">
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
            <HeatLegendStrip />
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <p className="flex-1 text-caption text-text-secondary">{warmestLine}</p>
            {todayLine === null ? null : (
              <p className="shrink-0 whitespace-nowrap text-caption tabular-nums text-text-muted">
                {todayLine}
              </p>
            )}
          </div>
        </div>
      </section>
    </Card>
  );
}
