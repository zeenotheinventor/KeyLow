import { todayPlanOf } from "@keylow/api-client";
import { BODY_MAP, describeBodyFigureLabel, describeDashboardBodyMapCard } from "@keylow/core/copy";
import { TRAINING_PARAMS_V2 } from "@keylow/core/training";
import { iconStroke } from "@keylow/tokens";
import { ChevronRight, Dumbbell } from "lucide-react";
import Link from "next/link";

import type { DashboardBodyMapCardProps } from "./types";
import type { DashboardBodyMap } from "@keylow/api-client";

import { BodyFigure } from "@/components/ui/BodyFigure";
import { Card } from "@/components/ui/Card";
import { HeatLegendStrip } from "@/components/ui/HeatLegendStrip";
import { VolumeLegendStrip } from "@/components/ui/VolumeLegendStrip";

const FIGURE_WIDTH = 100;
const BODY_MAP_HREF = "/body-map";

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
 * The body map on the dashboard as its board draws it: the title and the view with the Body map label and
 * its chevron, the front and back at 100 pixels with a legend strip beside them, the top three muscles and
 * today's planned day. The Dashboard chart setting picks the chart. Heat, the default, is Actual heat now
 * with the heat legend from Peak to Rested and the three warmest muscles. Weekly volume is the actual sets
 * of the calendar week, Monday to Sunday, with the volume legend from High to Not trained and the three
 * muscles with the most sets. The figure is drawn male until the figure setting reaches the web. There is
 * no toggle and no click on the figures. The whole card is one link to the body map page, so it is named by
 * what it shows and ends in "Open the body map", as the weekly card names its link. The section is
 * labelled by the short title, and the words and figures inside the link are hidden from assistive
 * technology, because that name already says all of it.
 */
export function DashboardBodyMapCard({ bodyMap }: DashboardBodyMapCardProps) {
  const { viewLine, summaryLine, todayLine, accessibleName } = cardWordsOf(bodyMap);
  const figureLabel = (side: "front" | "back") =>
    describeBodyFigureLabel({ scale: bodyMap.scale, view: "actual", side, hint: null });

  return (
    <Card asChild padding="none">
      <section aria-label={BODY_MAP.dashboardCard.title}>
        <Link
          href={BODY_MAP_HREF}
          aria-label={accessibleName}
          className="block rounded-large outline-none transition-colors duration-quick hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
        >
          <div aria-hidden className="flex flex-col gap-2 py-3 pl-4 pr-3">
            <div className="flex items-start justify-between gap-2">
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
                  {viewLine}
                </p>
              </div>
              <span className="flex min-h-touch-target items-center gap-0.5 text-text-secondary">
                <span className="text-label-small text-accent-ink">
                  {BODY_MAP.dashboardCard.link}
                </span>
                <ChevronRight className="size-4" strokeWidth={iconStroke} />
              </span>
            </div>
            <div className="flex items-end justify-center gap-7">
              <BodyFigure
                label={figureLabel("front")}
                scale={bodyMap.scale}
                side="front"
                values={bodyMap.values}
                w={FIGURE_WIDTH}
              />
              <BodyFigure
                label={figureLabel("back")}
                scale={bodyMap.scale}
                side="back"
                values={bodyMap.values}
                w={FIGURE_WIDTH}
              />
              {bodyMap.scale === "volume" ? <VolumeLegendStrip /> : <HeatLegendStrip />}
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <p className="flex-1 text-caption text-text-secondary">{summaryLine}</p>
              {todayLine === null ? null : (
                <p className="shrink-0 whitespace-nowrap text-caption tabular-nums text-text-muted">
                  {todayLine}
                </p>
              )}
            </div>
          </div>
        </Link>
      </section>
    </Card>
  );
}
