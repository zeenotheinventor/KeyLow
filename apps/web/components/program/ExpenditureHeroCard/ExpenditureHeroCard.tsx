import { PROGRAM_SCREEN } from "@keylow/core/copy";

import type { ExpenditureHeroCardProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CountingNumeral } from "@/components/ui/CountingNumeral";

// The board sets the figure at 40 over 46, which is between the type scale's sizes.
const NUMERAL_CLASS_NAME = "text-[40px] font-semibold leading-[46px] tracking-[-0.02em]";

/**
 * The estimate of what the person burns in a day, as `program-default` and `program-settling` draw it: the
 * eyebrow with the Estimate badge, and the Settling badge before it while the estimate is still the starting
 * one, the whole kilocalories in the 40 px numeral of the Trend weight card, the likely range, and a line
 * about where the estimate comes from. The card is named by its figure and its range. On the first open after a
 * new check-in the figure counts up from the estimate before it (see the kit's `CountingNumeral`).
 */
export function ExpenditureHeroCard({ view, arrival }: ExpenditureHeroCardProps) {
  return (
    <Card asChild className="flex flex-col gap-1">
      <section aria-label={view.name}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption uppercase tracking-[0.04em] text-text-secondary">
            {PROGRAM_SCREEN.hero.eyebrow}
          </span>
          <span className="flex gap-1">
            {view.isSettling && <Badge tone="warning">{PROGRAM_SCREEN.hero.settlingBadge}</Badge>}
            <Badge tone="accent">{PROGRAM_SCREEN.hero.estimateBadge}</Badge>
          </span>
        </div>
        <div className="flex items-baseline gap-1 tabular-nums">
          <CountingNumeral
            from={arrival?.fromKcal ?? null}
            value={view.muKcal}
            className={NUMERAL_CLASS_NAME}
          />
          <span className="text-body text-text-secondary">{PROGRAM_SCREEN.hero.unit}</span>
        </div>
        <span className="text-body tabular-nums">{view.rangeText}</span>
        <span className="text-caption tabular-nums text-text-secondary">{view.captionText}</span>
      </section>
    </Card>
  );
}
