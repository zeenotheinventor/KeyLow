import { PROGRAM_SCREEN, SETUP_ESTIMATE } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Calendar, Info } from "lucide-react";

import type { WeekTargetsCardProps } from "./types";

import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { MacroTile } from "@/components/ui/MacroTile";

/**
 * This week's targets as `program-default` draws them: the eyebrow with the day they were set, the calories in
 * a 32 px numeral, the line about what they are worth a week (or the guardrail that set them), the three
 * macros as the setup estimate's tiles, and the next check-in row under a hairline. The row waits for a date.
 * The card is named by its calories, and its macros and its row are read on their own.
 */
export function WeekTargetsCard({ view }: WeekTargetsCardProps) {
  const { checkIn, macros } = view;

  return (
    <Card asChild padding="none">
      <section aria-label={view.name}>
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption uppercase tracking-[0.04em] text-text-secondary">
              {PROGRAM_SCREEN.targets.eyebrow}
            </span>
            <span className="text-caption tabular-nums text-text-muted">{view.sinceText}</span>
          </div>
          <div className="flex items-baseline gap-1 tabular-nums">
            {/* The board sets the figure at 32 over 38, which is between the type scale's sizes. */}
            <span className="text-[32px] font-semibold leading-[38px] tracking-[-0.02em]">
              {view.kcalText}
            </span>
            <span className="text-body text-text-secondary">{PROGRAM_SCREEN.targets.unit}</span>
          </div>
          {view.line === null ? null : view.isGuardrail ? (
            // A guardrail line is the caption with an Info icon before it, as `program-checkin-guardrail` draws it.
            <div className="flex items-start gap-2">
              <Info
                aria-hidden
                className="size-4 shrink-0 text-text-secondary"
                strokeWidth={iconStroke}
              />
              <span className="min-w-0 flex-1 text-caption tabular-nums text-text-secondary">
                {view.line}
              </span>
            </div>
          ) : (
            <span className="text-body tabular-nums text-text-secondary">{view.line}</span>
          )}
          {macros === null ? null : (
            <dl className="mt-1 grid grid-cols-3 gap-2">
              <MacroTile
                label={SETUP_ESTIMATE.tileLabels.protein}
                colour="protein"
                grams={macros.proteinG}
                share={null}
              />
              <MacroTile
                label={SETUP_ESTIMATE.tileLabels.carbs}
                colour="carbs"
                grams={macros.carbsG}
                share={null}
              />
              <MacroTile
                label={SETUP_ESTIMATE.tileLabels.fat}
                colour="fat"
                grams={macros.fatG}
                share={null}
              />
            </dl>
          )}
        </div>
        {checkIn === null ? null : (
          <ul className="border-t border-border">
            <ListRow
              icon={Calendar}
              title={checkIn.title}
              subtitle={checkIn.caption}
              value={checkIn.dateText}
            />
          </ul>
        )}
      </section>
    </Card>
  );
}
