import { useSettlingChecklist } from "@keylow/api-client";
import { PROGRAM_SETTLING } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Info } from "lucide-react";

import type { SettlingChecklistProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { SettlingProgressBar } from "@/components/ui/SettlingProgressBar";

/**
 * What the first check-in needs, as `program-settling` draws it under the hero: the compact warning banner with
 * the first check-in's date, the three counts as bars and, while it can still help, the tip about the day to
 * weigh in. It draws nothing until its reads have answered, since a count of 0 would be wrong, not empty.
 */
export function SettlingChecklist(props: SettlingChecklistProps) {
  const view = useSettlingChecklist({ ...props, enabled: true });

  if (view === null) {
    return null;
  }

  return (
    <Banner tone="review" size="compact" hasIcon={false} title={view.title}>
      {PROGRAM_SETTLING.intro}
      {/* The board leaves 12 between the words, each bar and the tip. */}
      <span className="mt-3 flex flex-col gap-3">
        {view.rows.map((row) => (
          <SettlingProgressBar
            key={row.name}
            label={row.label}
            name={row.name}
            count={row.count}
            target={row.target}
          />
        ))}
        {view.tip === null ? null : (
          <span className="flex gap-1.5">
            <Info
              aria-hidden
              className="mt-px size-3.5 shrink-0 text-text-secondary"
              strokeWidth={iconStroke}
            />
            <span className="min-w-0 flex-1 text-caption tabular-nums text-text-secondary">
              {view.tip}
            </span>
          </span>
        )}
      </span>
    </Banner>
  );
}
