import { useActiveRoutine, useMuscleDetail } from "@keylow/api-client";
import { BODY_MAP, TRAIN_ERROR, describeMuscleSheet } from "@keylow/core/copy";
import { TRAINING_PARAMS_V2, upcomingSessionsOf, weightingExampleOf } from "@keylow/core/training";

import { MuscleSheetContent } from "../MuscleSheetContent";

import type { MuscleSheetBodyProps } from "./types";

import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Reads one muscle's detail and writes the sheet from it, mounted only while the sheet is open. The words
 * are `describeMuscleSheet`'s and nothing is worked out here. While the detail is read, or if reading it
 * failed, the dialog still names the muscle and has its Close button.
 */
export function MuscleSheetBody({
  muscle,
  view,
  at,
  weekStart,
  now,
  days,
  onEditRoutine,
}: MuscleSheetBodyProps) {
  const detail = useMuscleDetail(muscle, { view, at, weekStart, now });
  const routine = useActiveRoutine();

  if (detail.data === undefined) {
    return detail.isError ? (
      <ErrorState
        title={TRAIN_ERROR.title}
        body={TRAIN_ERROR.body}
        retryLabel={TRAIN_ERROR.action}
        size="section"
        onRetry={() => {
          void detail.refetch();
        }}
      />
    ) : (
      <Skeleton variant="rows" count={2} label={BODY_MAP.dashboardCard.loadingLabel} />
    );
  }

  const copy = describeMuscleSheet(detail.data, {
    weekStart,
    upcomingSessions: upcomingSessionsOf(days),
    heatWindowDays: TRAINING_PARAMS_V2.heatWindowDays,
    weightingExample: weightingExampleOf(routine.data ?? null, muscle),
  });

  return <MuscleSheetContent copy={copy} detail={detail.data} onEditRoutine={onEditRoutine} />;
}
