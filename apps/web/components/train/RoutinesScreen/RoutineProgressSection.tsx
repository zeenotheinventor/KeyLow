import { useRoutineProgress } from "@keylow/api-client";
import {
  EXERCISE_PROGRESS,
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINE_PROGRESS,
  TRAIN_ERROR,
} from "@keylow/core/copy";
import { useId } from "react";

import { RoutineProgressDay } from "../RoutineProgressDay";

import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The Progress section of the routines page, as the `web-train · routines-progress` boards draw it: the
 * heading over a group for each day of the routine, each exercise a row with its change and sparkline. It is
 * only mounted for the active routine, so a page with none reads nothing for it. A routine with no exercise
 * draws nothing, as the phone does. Failed online it is the error state with Try again in the place of the
 * groups. Offline, what the visit has read is shown as read, and with some read not held it is the train
 * error's words with no button, because a read waits for a connection that may not come and neither a
 * skeleton nor Try again would help.
 */
export function RoutineProgressSection({ routineId }: { routineId: string }) {
  const headingId = useId();
  const { state, notRead } = useRoutineProgress(routineId, {
    enabled: true,
    now: useNow(),
    isOnline: useIsOnline(),
  });

  function renderBody() {
    if (notRead) {
      return <ErrorState title={TRAIN_ERROR.title} body={TRAIN_ERROR.body} />;
    }
    switch (state.status) {
      case "loading":
        return <Skeleton variant="rows" count={3} label={EXERCISE_PROGRESS.loadingName} />;
      case "error":
        return (
          <ErrorState title={GENERIC_ERROR} retryLabel={RETRY_LABEL} onRetry={state.onRetry} />
        );
      case "ready":
        return state.days.map((day) => <RoutineProgressDay day={day} key={day.id} />);
    }
  }

  if (state.status === "ready" && state.days.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 xl:w-[360px] xl:shrink-0"
    >
      <h2 id={headingId} className="flex min-h-[32px] items-center px-1 text-h2">
        {ROUTINE_PROGRESS.heading}
      </h2>
      {renderBody()}
    </section>
  );
}
