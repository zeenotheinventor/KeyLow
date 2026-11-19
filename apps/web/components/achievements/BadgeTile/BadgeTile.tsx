import { achievementBadgeLabel } from "@keylow/core/copy";

import type { BadgeTileProps } from "./types";

import { AchievementBadge } from "@/components/ui/AchievementBadge";

const BADGE_SIZE = 64;

/** One badge of the grid: the medal, its name and a line under it. Pressing it opens the detail dialog. */
export function BadgeTile({ badge, onOpen }: BadgeTileProps) {
  const { id, name, state, subLine, progressWords } = badge;

  return (
    <button
      type="button"
      aria-label={achievementBadgeLabel({ id, state, progress: progressWords })}
      onClick={() => {
        onOpen(id);
      }}
      className="flex min-h-touch-target flex-col items-center gap-1.5 rounded-medium p-1 text-center outline-none transition-colors duration-quick hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset"
    >
      <AchievementBadge id={id} state={state} size={BADGE_SIZE} decorative />
      <span className="text-[12px] font-semibold leading-[15px]">{name}</span>
      <span className="text-[11px] font-medium leading-[14px] text-text-muted">{subLine}</span>
    </button>
  );
}
