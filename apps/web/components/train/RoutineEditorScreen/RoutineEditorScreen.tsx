"use client";

import { useRoutine } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  ROUTINE_EDITOR,
  ROUTINE_EDITOR_LOADING_LABEL,
  ROUTINES_SCREEN,
  RETRY_LABEL,
} from "@keylow/core/copy";
import { draftOfStoredRoutine, exerciseNamesOfStoredRoutine } from "@keylow/core/training";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { RoutineEditor } from "../RoutineEditor";

import type { RoutineEditorScreenProps } from "./types";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { trainRoutinesPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * `/train/routines/<id>`: reads the routine and opens the editor on it. The editor takes the routine as it
 * was when the screen opened, so a refetch under it never changes what the person is typing. A routine that
 * is not there, or an address that is not a routine's id, goes to the routines list. A failed read says so
 * and offers to try again. With no connection and nothing read the page says so and offers nothing to try,
 * as the read would only wait: it goes by itself when the browser is back online.
 */
export function RoutineEditorScreen({ id }: RoutineEditorScreenProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const routine = useRoutine(id);
  // An address that is not an id never reaches the database: the read refuses it with a RangeError.
  const isMissing = routine.data === null || routine.error instanceof RangeError;

  useEffect(() => {
    if (isMissing) {
      router.replace(trainRoutinesPath());
    }
  }, [isMissing, router]);

  if (routine.data !== undefined && routine.data !== null) {
    return (
      <RoutineEditor
        key={routine.data.id}
        exerciseNames={exerciseNamesOfStoredRoutine(routine.data)}
        initialDraft={draftOfStoredRoutine(routine.data)}
        routineId={routine.data.id}
        isActive={routine.data.is_active}
        isArchived={routine.data.is_archived}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <BackToFoodsLink tone="accent" label={ROUTINES_SCREEN.title} href={trainRoutinesPath()} />
      <h1 className="text-h1">{ROUTINE_EDITOR.title}</h1>
      {isMissing ? null : routine.isError || !isOnline ? (
        <ErrorState
          title={GENERIC_ERROR}
          retryLabel={RETRY_LABEL}
          {...(isOnline
            ? {
                onRetry: () => {
                  void routine.refetch();
                },
              }
            : {})}
        />
      ) : (
        <Skeleton label={ROUTINE_EDITOR_LOADING_LABEL} variant="block" />
      )}
    </div>
  );
}
