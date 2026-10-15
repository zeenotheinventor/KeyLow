import { DASHBOARD_CARD, describeDashboardCard, describeTargetCaption } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { NutritionCardProps } from "./types";

import { CalorieRing } from "@/components/ui/CalorieRing";
import { Card } from "@/components/ui/Card";
import { MacroBars } from "@/components/ui/MacroBars";
import { cn } from "@/lib/utils";

const TARGETS_HREF = "/more/targets";

// The press surface is clipped by the card, so its focus ring is drawn inside it.
const pressFocusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

// The Edit link is the board's text link: the accent ink, 14 px semibold, and a 44 px target.
const editLinkClassName =
  "flex min-h-touch-target items-center rounded-small px-1 text-body-strong text-accent-ink outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

/**
 * Today's nutrition as the dashboard board draws it: the card's title with a chevron, the calorie ring
 * and the three macro bars, all one link to the Diary for today, named by the title, the ring and the
 * bars. Under a hairline, outside that link so nothing interactive is nested, sit the calorie target and
 * Edit, which opens Targets. The footer is left off when no calorie target is set. The ring and the bars
 * sit side by side from the small breakpoint, where each bar's track is still over 100 px wide in the
 * half column at 1280, and stack below it.
 */
export function NutritionCard({ totals, targets }: NutritionCardProps) {
  const calorieTarget = targets.kcal ?? 0;
  const hasTarget = calorieTarget > 0;

  return (
    <Card asChild padding="none">
      <section aria-label={DASHBOARD_CARD.regionName}>
        <Link
          href="/diary"
          aria-label={describeDashboardCard(totals, targets)}
          className={cn(
            "flex flex-col gap-4 px-4 pt-4 transition-colors duration-quick hover:bg-hover-overlay sm:px-5",
            hasTarget ? "pb-3" : "pb-4",
            pressFocusRing,
          )}
        >
          <span className="flex items-center gap-2">
            <h2 className="flex-1 text-h2">{DASHBOARD_CARD.title}</h2>
            <ChevronRight
              aria-hidden
              className="size-4 shrink-0 text-text-muted"
              strokeWidth={iconStroke}
            />
          </span>
          <span className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <CalorieRing
              eaten={totals.kcal ?? 0}
              target={calorieTarget}
              estimate={false}
              className="shrink-0"
            />
            <MacroBars
              protein={{ eaten: totals.protein_g ?? 0, target: targets.protein_g ?? 0 }}
              carbs={{ eaten: totals.carbs_g ?? 0, target: targets.carbs_g ?? 0 }}
              fat={{ eaten: totals.fat_g ?? 0, target: targets.fat_g ?? 0 }}
              className="w-full min-w-0 sm:w-auto sm:flex-1"
            />
          </span>
        </Link>
        {hasTarget && (
          <div className="mx-4 flex min-h-touch-target items-center justify-between gap-3 border-t border-border py-1 sm:mx-5">
            <span className="text-caption tabular-nums text-text-secondary">
              {describeTargetCaption(calorieTarget)}
            </span>
            <Link
              href={TARGETS_HREF}
              aria-label={DASHBOARD_CARD.editName}
              className={editLinkClassName}
            >
              {DASHBOARD_CARD.edit}
            </Link>
          </div>
        )}
      </section>
    </Card>
  );
}
