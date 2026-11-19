import { WEB_ACHIEVEMENTS } from "@keylow/core/copy";

import type { BadgeDetailDialogProps } from "./types";

import { AchievementProgressBar } from "@/components/achievements/AchievementProgressBar";
import { AchievementBadge } from "@/components/ui/AchievementBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

const BADGE_SIZE = 148;

/**
 * The detail of one badge, as board 2 draws it: the medal, its tier and category, what earns it and then the
 * facts. An earned badge says when and how many points, a locked one how far along it is and what it is worth,
 * and a hidden one keeps its secret. The dialog's heading is the badge's name.
 */
export function BadgeDetailDialog({ id, detail, onClose }: BadgeDetailDialogProps) {
  const { title, state, tierLine, description, progress, facts } = detail;

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      closeLabel={WEB_ACHIEVEMENTS.closeLabel}
      footer={
        <Button variant="secondary" onClick={onClose} className="w-full">
          {WEB_ACHIEVEMENTS.doneLabel}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <AchievementBadge id={id} state={state} size={BADGE_SIZE} decorative />
        <Badge outlined>{tierLine}</Badge>
        <p className="text-body text-text-secondary">{description}</p>
        {progress !== undefined && (
          <div className="flex w-full flex-col gap-2">
            <AchievementProgressBar
              label={`${title} progress`}
              value={progress.current}
              max={progress.target}
            />
            <div className="flex justify-between text-caption text-text-muted">
              <span>{progress.words}</span>
              <span>{progress.remaining}</span>
            </div>
          </div>
        )}
        {facts.length > 0 && (
          <dl className="grid w-full grid-cols-2 gap-2 text-left">
            {facts.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-medium border border-border bg-surface px-3 py-2.5"
              >
                <dt className="text-caption text-text-muted">{label}</dt>
                <dd className="text-[17px] font-semibold leading-6">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </Dialog>
  );
}
