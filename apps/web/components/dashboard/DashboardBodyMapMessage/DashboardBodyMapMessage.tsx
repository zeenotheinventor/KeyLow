import { BODY_MAP } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Dumbbell } from "lucide-react";

import type { DashboardBodyMapMessageProps } from "./types";

import { Card } from "@/components/ui/Card";

/**
 * The body map card when it has nothing to show: its title over one quiet line, either that a read failed
 * or that the body map is not available offline. There is no Try again, because the card reads again by
 * itself and the dashboard's own error state is where a failed read is retried. It is not a link,
 * because a read that failed or a browser with nothing saved has no body map to open.
 */
export function DashboardBodyMapMessage({ kind }: DashboardBodyMapMessageProps) {
  return (
    <Card asChild padding="none">
      <section
        aria-label={BODY_MAP.dashboardCard.title}
        className="flex flex-col gap-2 py-3 pl-4 pr-3"
      >
        <p className="flex items-center gap-1.5 text-caption text-text-muted">
          <Dumbbell
            aria-hidden
            className="size-[14px] shrink-0 text-text-secondary"
            strokeWidth={iconStroke}
          />
          {BODY_MAP.dashboardCard.title}
        </p>
        <p className="text-body text-text-secondary">
          {kind === "failed"
            ? BODY_MAP.dashboardCard.loadFailed
            : BODY_MAP.dashboardCard.offlineUnavailable}
        </p>
      </section>
    </Card>
  );
}
