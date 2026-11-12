"use client";

import { SETUP_ESTIMATE } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Info } from "lucide-react";

import type { EstimateCardProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CountingNumeral } from "@/components/ui/CountingNumeral";
import { MacroTile } from "@/components/ui/MacroTile";
import { cn } from "@/lib/utils";

// The first tile cuts in 160 ms after arrival and the next two follow 36 ms apart (the stagger token), as the
// board draws them. The delays are a fixed set, so each class is written out for Tailwind to see. Reduced
// motion only fades, at once.
const tileDelayClassNames = [
  "[animation-delay:160ms] motion-reduce:[animation-delay:0ms]",
  "[animation-delay:196ms] motion-reduce:[animation-delay:0ms]",
  "[animation-delay:232ms] motion-reduce:[animation-delay:0ms]",
] as const;

/**
 * The calorie target of the estimate, with the onboarding flourish the design system reserves one of. On arrival
 * the numeral counts up from nothing and flashes the accent, one accent slash crosses the card and the three
 * tiles cut in from the side 36 ms apart, once. With reduced motion there is no count, flash or slash, and the
 * tiles only fade. While the numeral counts, the figure on screen is hidden from a screen reader, which is given
 * the final target alone. There is no haptic on the web.
 */
export function EstimateCard({ targets, lines }: EstimateCardProps) {
  const tiles = [
    { label: SETUP_ESTIMATE.tileLabels.protein, colour: "protein", grams: targets.proteinG },
    { label: SETUP_ESTIMATE.tileLabels.carbs, colour: "carbs", grams: targets.carbsG },
    { label: SETUP_ESTIMATE.tileLabels.fat, colour: "fat", grams: targets.fatG },
  ] as const;

  return (
    <Card role="group" aria-label={SETUP_ESTIMATE.card.name} className="flex flex-col gap-2">
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-[20%] -top-[20%] left-0 w-[16%] animate-slash bg-accent opacity-0 motion-reduce:animate-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-body-strong text-text-secondary">{SETUP_ESTIMATE.card.title}</span>
        <Badge tone="accent">{SETUP_ESTIMATE.card.badge}</Badge>
      </div>
      <div className="flex items-baseline gap-1.5">
        <CountingNumeral
          from={0}
          value={targets.caloriesKcal}
          className="text-display-numeral tabular-nums"
        />
        <span className="text-body text-text-secondary">{SETUP_ESTIMATE.card.caloriesUnit}</span>
      </div>
      {lines.rateLine === undefined ? null : (
        <p className="text-body tabular-nums text-text-secondary">{lines.rateLine}</p>
      )}
      {lines.guardrailLines.map((line) => (
        <div key={line} className="flex items-start gap-2">
          <Info
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-text-secondary"
            strokeWidth={iconStroke}
          />
          <span className="min-w-0 flex-1 text-caption tabular-nums text-text-secondary">
            {line}
          </span>
        </div>
      ))}
      <dl className="mt-2 grid grid-cols-3 gap-2">
        {tiles.map((tile, index) => (
          <MacroTile
            key={tile.colour}
            label={tile.label}
            colour={tile.colour}
            grams={tile.grams}
            share={null}
            className={cn(
              "min-w-0 animate-kl-cut-in motion-reduce:animate-kl-fade-in",
              tileDelayClassNames[index],
            )}
          />
        ))}
      </dl>
    </Card>
  );
}
