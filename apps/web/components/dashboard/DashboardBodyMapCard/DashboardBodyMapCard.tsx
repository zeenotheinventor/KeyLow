import { todayPlanOf } from "@keylow/api-client";
import {
  BODY_MAP,
  describeBodyFigureLabel,
  describeDashboardBodyMapCard,
  describeDashboardVolumeCard,
} from "@keylow/core/copy";
import { TRAINING_PARAMS_V2 } from "@keylow/core/training";
import { iconStroke } from "@keylow/tokens";
import { ChevronRight, Dumbbell } from "lucide-react";
import Link from "next/link";

import type { DashboardBodyMapCardProps } from "./types";

import { BodyFigure } from "@/components/ui/BodyFigure";
import { Card } from "@/components/ui/Card";
import { HeatLegendStrip } from "@/components/ui/HeatLegendStrip";
import { VolumeLegendStrip } from "@/components/ui/VolumeLegendStrip";
import { bodyMapPath } from "@/lib/bodyMapRoutes";

const FIGURE_WIDTH = 100;

/**
 * The body map on the dashboard as its boards draw it: the title and the view with the Body map label and
 * its chevron, front and back at 100 pixels, the legend of the scale beside them, a summary line and
 * today's planned day. Heat, the default, shows Actual heat now, the heat legend from Peak to Rested and
 * the three warmest muscles. Weekly volume shows this week's Actual volume, Monday to Sunday, on the Volume
 * scale of the body map, with the volume legend from High to None and the count of muscles at Growing or
 * above. The figure is the one it is given, male unless told otherwise. There is no toggle and no click on
 * the figures. The whole card is one link to the body map page, on Volume in Weekly volume, so it is named
 * by what it shows and ends in the words that open the map, as the weekly card names its link. The section
 * is labelled by the short title in both, and the words and figures inside the link are hidden from
 * assistive technology, because that name already says all of it.
 */
export function DashboardBodyMapCard({ bodyMap, body, scale = "heat" }: DashboardBodyMapCardProps) {
  const { viewLabel, summaryLine, todayLine, accessibleName } =
    scale === "volume" ? volumeWordsOf(bodyMap) : heatWordsOf(bodyMap);
  const figureLabel = (side: "front" | "back") =>
    describeBodyFigureLabel({ scale, view: "actual", side, hint: null });

  return (
    <Card asChild padding="none">
      <section aria-label={BODY_MAP.dashboardCard.title}>
        <Link
          href={bodyMapPath(scale)}
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
                  {viewLabel}
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
                body={body}
                label={figureLabel("front")}
                scale={scale}
                side="front"
                values={bodyMap.values}
                w={FIGURE_WIDTH}
              />
              <BodyFigure
                body={body}
                label={figureLabel("back")}
                scale={scale}
                side="back"
                values={bodyMap.values}
                w={FIGURE_WIDTH}
              />
              {scale === "volume" ? <VolumeLegendStrip /> : <HeatLegendStrip />}
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

function volumeWordsOf({ values, today }: DashboardBodyMapCardProps["bodyMap"]) {
  const { summaryLine, todayLine, accessibleName } = describeDashboardVolumeCard({
    values,
    today: todayPlanOf(today),
  });
  return { viewLabel: BODY_MAP.dashboardCard.volumeView, summaryLine, todayLine, accessibleName };
}

function heatWordsOf({ warmest, today }: DashboardBodyMapCardProps["bodyMap"]) {
  const { warmestLine, todayLine, accessibleName } = describeDashboardBodyMapCard({
    warmest,
    today: todayPlanOf(today),
    heatWindowDays: TRAINING_PARAMS_V2.heatWindowDays,
    opensBodyMap: true,
  });
  return {
    viewLabel: BODY_MAP.dashboardCard.view,
    summaryLine: warmestLine,
    todayLine,
    accessibleName,
  };
}
