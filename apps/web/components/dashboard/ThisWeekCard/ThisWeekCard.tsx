import {
  WEEK_CARD,
  describeDaysComplete,
  describeThisWeekCard,
  describeWeekGridTitle,
  describeWeekStripName,
} from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { DayMarkers } from "../DayMarkers";
import { WeekAverageBar } from "../WeekAverageBar";

import type { ThisWeekCardProps } from "./types";

import { Card } from "@/components/ui/Card";
import { diaryHref } from "@/lib/diary";

/**
 * The week so far as the dashboard board draws it: the title with a chevron and the week's Monday, the
 * average calories against the target, the seven day markers and the days complete. The whole card is one
 * link to the diary's Week view, named by the title, the average and the days complete. The words inside
 * it are hidden from assistive technology, because that name already says all of it.
 */
export function ThisWeekCard({ summary }: ThisWeekCardProps) {
  const title = describeWeekStripName(summary.weekStart, true);

  return (
    <Card asChild padding="none">
      <section aria-label={title}>
        <Link
          href={diaryHref({ view: "week" })}
          aria-label={describeThisWeekCard(summary, "week")}
          className="block rounded-large outline-none transition-colors duration-quick hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
        >
          <div aria-hidden className="flex flex-col gap-4 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <h2 className="flex-1 text-h2">{title}</h2>
                <ChevronRight
                  className="size-4 shrink-0 text-text-muted"
                  strokeWidth={iconStroke}
                />
              </div>
              <p className="text-caption text-text-muted">
                {describeWeekGridTitle(summary.weekStart)}
              </p>
            </div>
            {summary.averageKcal === null ? (
              <p className="text-body text-text-secondary">{WEEK_CARD.nothingLogged}</p>
            ) : (
              <WeekAverageBar
                averageKcal={summary.averageKcal}
                targetKcal={summary.targetKcal}
                barFill={summary.barFill}
                kcalOverTarget={summary.kcalOverTarget}
                daysLogged={summary.daysLogged}
              />
            )}
            <span className="h-px bg-border" />
            <div className="flex flex-col gap-2">
              <DayMarkers markers={summary.markers} />
              <p className="text-body-strong tabular-nums">
                {describeDaysComplete(summary.daysComplete, summary.daysSoFar)}
              </p>
            </div>
          </div>
        </Link>
      </section>
    </Card>
  );
}
