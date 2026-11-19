import { useId } from "react";

import type { CategorySectionProps } from "./types";

import { BadgeTile } from "@/components/achievements/BadgeTile";
import { Card } from "@/components/ui/Card";

/** One category of the catalogue: its heading, how many are earned, and its badges, 4 across and 8 from the large breakpoint. */
export function CategorySection({ category, onOpenBadge }: CategorySectionProps) {
  const headingId = useId();

  return (
    <Card asChild>
      <section aria-labelledby={headingId} className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 id={headingId} className="text-[17px] font-semibold leading-6">
            {category.heading}
          </h2>
          <p className="text-caption text-text-muted">{category.countLabel}</p>
        </div>
        <div className="grid grid-cols-4 gap-x-1.5 gap-y-3 lg:grid-cols-8 lg:gap-3">
          {category.badges.map((badge) => (
            <BadgeTile key={badge.id} badge={badge} onOpen={onOpenBadge} />
          ))}
        </div>
      </section>
    </Card>
  );
}
