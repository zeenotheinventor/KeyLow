import { useProfileTimeZone, useQuickAdd } from "@keylow/api-client";
import { ADDED_TOAST, QUICK_ADD_FORM } from "@keylow/core/copy";
import { clockTimeOn, openingLoggedAt } from "@keylow/core/diary";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { EntryLoadState } from "../../components/EntryLoadState";
import { QuickAddForm } from "../../components/QuickAddForm";
import { useToast } from "../../components/ui";
import { useIsOnline } from "../../lib/connectivity";
import { readLogContext, useCloseFoodsSheet, useGoBackInFoodsSheet } from "../../lib/navigation";
import { usePlate } from "../../lib/plate";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { QuickAddSubmission } from "../../components/QuickAddForm";

/**
 * The new quick add form: calories and macros by hand, opened from the log search's Quick add row. It reads
 * `day` and `time` as the search carries them, so the Time row shows the hour an hour's plus was pressed on
 * ("12:00") or "Now" with the current time. Add logs the quick add at the time the row shows and shows the
 * toast. It never goes on the plate. With an empty plate it closes the sheet to the diary. With foods on the
 * plate it goes back to the search instead, so the plate is kept.
 */
export default function QuickAddRoute() {
  const goBack = useGoBackInFoodsSheet();
  const closeSheet = useCloseFoodsSheet();
  const plate = usePlate();
  const toast = useToast();
  const isOnline = useIsOnline();
  const quickAdd = useQuickAdd();
  const { day, time } = useLocalSearchParams<{ day?: string; time?: string }>();
  // The diary reads its days and hours in the profile's zone, so the time logged here is read in it too.
  const profileTimeZone = useProfileTimeZone({ enabled: useReadsEnabled() });
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  // The moment the screen opened, so "Now" does not move while the form is open.
  const [openedAt] = useState(() => new Date());
  const logContext = readLogContext({ day, time });

  if (profileTimeZone.isError) {
    return (
      <EntryLoadState
        state="error"
        title={QUICK_ADD_FORM.title}
        onBack={goBack}
        onRetry={() => {
          void profileTimeZone.refetch();
        }}
      />
    );
  }

  if (profileTimeZone.data === undefined) {
    return (
      <EntryLoadState
        state="loading"
        title={QUICK_ADD_FORM.title}
        onBack={goBack}
        onRetry={goBack}
      />
    );
  }

  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const timeZone = profileTimeZone.data ?? "UTC";
  const initial = openingLoggedAt(openedAt, logContext, timeZone);

  async function handleSubmit(submission: QuickAddSubmission) {
    setIsSaving(true);
    setHasSaveError(false);
    try {
      const { loggedAt, localDate } = submission.isNow
        ? initial
        : clockTimeOn(initial.localDate, submission.time, timeZone);
      await quickAdd.mutateAsync({
        kcal: submission.kcal,
        ...(submission.protein_g === null ? {} : { protein_g: submission.protein_g }),
        ...(submission.carbs_g === null ? {} : { carbs_g: submission.carbs_g }),
        ...(submission.fat_g === null ? {} : { fat_g: submission.fat_g }),
        ...(submission.label === null ? {} : { label: submission.label }),
        loggedAt: loggedAt.toISOString(),
        localDate,
      });
      toast.show({ message: ADDED_TOAST, tone: "success", icon: "Check" });
      if (plate.count > 0) {
        goBack();
      } else {
        closeSheet();
      }
    } catch {
      // The failure is not kept: it can quote the values, which are health data. The banner says what to do.
      setHasSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <QuickAddForm
      hasSaveError={hasSaveError}
      isNow={logContext?.time === undefined}
      isOnline={isOnline}
      isSaving={isSaving}
      mode="create"
      time={initial.clockTime}
      onLeave={closeSheet}
      onSubmit={(submission) => {
        void handleSubmit(submission);
      }}
    />
  );
}
