import { useActiveRoutine, useMuscleDetail } from "@keylow/api-client";
import { BODY_MAP, MUSCLE_NAMES, TRAIN_ERROR, describeMuscleSheet } from "@keylow/core/copy";
import { TRAINING_PARAMS_V2, upcomingSessionsOf, weightingExampleOf } from "@keylow/core/training";
import { View } from "react-native";

import { ErrorState, Skeleton } from "../../ui";
import { MuscleSheetContent } from "../MuscleSheetContent";
import { MuscleSheetHeader } from "../MuscleSheetHeader";

import type { MuscleSheetBodyProps } from "./types";

/**
 * Reads one muscle's detail and writes the sheet from it, mounted only while the sheet shows that muscle.
 * The words are `describeMuscleSheet`'s and nothing is worked out here. While the detail is read, or if
 * reading it failed, the header still names the muscle and has its Close button.
 */
export function MuscleSheetBody({
  muscle,
  view,
  at,
  weekStart,
  now,
  days,
  enabled,
  onClose,
}: MuscleSheetBodyProps) {
  const detail = useMuscleDetail(muscle, { view, at, weekStart, now, enabled });
  const routine = useActiveRoutine({ enabled });

  if (detail.data === undefined) {
    return (
      <View className="gap-4">
        <MuscleSheetHeader subtitle={null} title={MUSCLE_NAMES[muscle]} onClose={onClose} />
        {detail.isError ? (
          <ErrorState
            body={TRAIN_ERROR.body}
            retry={{
              label: TRAIN_ERROR.action,
              onPress: () => {
                void detail.refetch();
              },
            }}
            size="section"
            title={TRAIN_ERROR.title}
          />
        ) : (
          <View accessible aria-label={BODY_MAP.dashboardCard.loadingLabel} role="status">
            <Skeleton rows={2} variant="group" />
          </View>
        )}
      </View>
    );
  }

  const copy = describeMuscleSheet(detail.data, {
    weekStart,
    upcomingSessions: upcomingSessionsOf(days),
    heatWindowDays: TRAINING_PARAMS_V2.heatWindowDays,
    weightingExample: weightingExampleOf(routine.data ?? null, muscle),
  });

  return <MuscleSheetContent copy={copy} detail={detail.data} onClose={onClose} />;
}
