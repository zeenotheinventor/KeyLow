import { COPY_FAILED_BANNER, DIARY_ACTIONS, EMPTY_DAY } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Copy } from "lucide-react";

import type { EmptyDayCardProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * The small card above 00:00 on a day with nothing logged: "Nothing logged yet", a hint, and a Copy
 * yesterday button, which copies the whole day. It is dimmed, with the reason, when yesterday is empty
 * too or the app is offline, and says so when the copy failed.
 */
export function EmptyDayCard({
  isOnline,
  isYesterdayEmpty,
  isCopying,
  hasCopyFailed,
  onCopyYesterday,
}: EmptyDayCardProps) {
  return (
    <Card asChild padding="none">
      <section
        aria-label={EMPTY_DAY.title}
        className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex flex-col">
          <h2 className="text-body-strong">{EMPTY_DAY.title}</h2>
          <p className="text-caption text-text-muted">
            {isYesterdayEmpty ? DIARY_ACTIONS.nothingLoggedYesterday : EMPTY_DAY.webHint}
          </p>
          {hasCopyFailed && (
            <p role="alert" className="text-caption text-text-primary">
              {COPY_FAILED_BANNER}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={isYesterdayEmpty || !isOnline}
          loading={isCopying}
          onClick={onCopyYesterday}
        >
          <Copy aria-hidden strokeWidth={iconStroke} />
          {DIARY_ACTIONS.copyYesterday}
        </Button>
      </section>
    </Card>
  );
}
