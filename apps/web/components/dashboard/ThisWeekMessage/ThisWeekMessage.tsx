import {
  DASHBOARD_LOAD_FAILED,
  RETRY_LABEL,
  WEEK_CARD,
  describeWeekGridTitle,
  describeWeekStripName,
} from "@keylow/core/copy";

import type { ThisWeekMessageProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * The This week card when it has no week to show: its title and the week's Monday, then either an error
 * inside the card with Try again, or the line that the week is not available offline. It is not a link,
 * because there is nothing in it to open. The Today card beside it is unaffected.
 */
export function ThisWeekMessage(props: ThisWeekMessageProps) {
  const title = describeWeekStripName(props.weekStart, true);

  return (
    <Card asChild padding="none">
      <section aria-label={title} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-h2">{title}</h2>
          <p className="text-caption text-text-muted">{describeWeekGridTitle(props.weekStart)}</p>
        </div>
        {props.kind === "failed" ? (
          <div role="alert" className="flex flex-col items-start gap-1">
            <p className="text-body-strong">{WEEK_CARD.loadFailed}</p>
            <p className="text-body text-text-secondary">{DASHBOARD_LOAD_FAILED.body}</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={props.onRetry}>
              {RETRY_LABEL}
            </Button>
          </div>
        ) : (
          <p className="text-body text-text-secondary">{WEEK_CARD.offlineUnavailable}</p>
        )}
      </section>
    </Card>
  );
}
