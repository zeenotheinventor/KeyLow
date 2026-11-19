import { WEB_ACHIEVEMENTS } from "@keylow/core/copy";

import type { AchievementsErrorProps } from "./types";

import { ErrorState } from "@/components/ui/ErrorState";

/** The error board: a page that never loaded, with Try again. */
export function AchievementsError({ onRetry }: AchievementsErrorProps) {
  return (
    <ErrorState
      title={WEB_ACHIEVEMENTS.loadFailedTitle}
      body={WEB_ACHIEVEMENTS.loadFailedBody}
      size="page"
      onRetry={onRetry}
    />
  );
}
