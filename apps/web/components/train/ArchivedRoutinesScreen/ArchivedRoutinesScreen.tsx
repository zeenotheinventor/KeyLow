"use client";

import { useRoutines } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINES_ARCHIVED,
  ROUTINES_OFFLINE,
  TRAIN_LOADING_NAME,
  describeArchivedRoutineMeta,
  describeRestoreName,
} from "@keylow/core/copy";
import { useEffect, useId, useRef, useState } from "react";

import { RoutineActionRow } from "../RoutineActionRow";
import { useRestoreRoutine } from "./useRestoreRoutine";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { trainRoutinesPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * The archived routines, as the `routines · archived` board draws them in the web shell: Back to Routines
 * and the title, a card of the routines and a note on what archived means. They are read from the list's
 * one request, which brings them with the live routines. A row is plain information, because an archived
 * routine is restored before it is opened, and the database does not keep the day it was archived, so a
 * row gives its days alone.
 */
export function ArchivedRoutinesScreen() {
  const isOnline = useIsOnline();
  const restore = useRestoreRoutine();
  const offlineLineId = useId();
  // The routine focus goes to once a restored one has left the list: the next Restore, else the one before, else Back.
  const [focusAfterRestore, setFocusAfterRestore] = useState<{
    restoredId: string;
    nextId: string | null;
  } | null>(null);
  const restoreButtons = useRef(new Map<string, HTMLButtonElement>());
  const backLink = useRef<HTMLAnchorElement>(null);
  // The restored routine whose focus move is done, so the effect below moves focus once and never sets state.
  const focusedRestoredId = useRef<string | null>(null);
  const routines = useRoutines({ archived: true });
  const archived = routines.data?.filter((routine) => routine.is_archived) ?? [];
  const isRestoredRoutineGone =
    focusAfterRestore !== null &&
    routines.data !== undefined &&
    !archived.some((routine) => routine.id === focusAfterRestore.restoredId);

  useEffect(() => {
    if (
      focusAfterRestore !== null &&
      isRestoredRoutineGone &&
      focusedRestoredId.current !== focusAfterRestore.restoredId
    ) {
      focusedRestoredId.current = focusAfterRestore.restoredId;
      const next =
        focusAfterRestore.nextId === null
          ? undefined
          : restoreButtons.current.get(focusAfterRestore.nextId);
      (next ?? backLink.current)?.focus();
    }
  }, [focusAfterRestore, isRestoredRoutineGone]);

  function restoreAndMoveFocus(index: number) {
    const restored = archived[index];
    if (restored === undefined) {
      return;
    }
    const nextId = (archived[index + 1] ?? archived[index - 1])?.id ?? null;
    void restore(restored.id).then((isRestored) => {
      if (isRestored) {
        focusedRestoredId.current = null;
        setFocusAfterRestore({ restoredId: restored.id, nextId });
      }
    });
  }

  function renderBody() {
    if (routines.data === undefined) {
      // With no connection and nothing read, the read waits for a connection that may not come. Try again
      // would only join that wait, so it is not offered until the browser is online, when the read goes by itself.
      return routines.isError || !isOnline ? (
        <ErrorState
          title={GENERIC_ERROR}
          retryLabel={RETRY_LABEL}
          {...(isOnline
            ? {
                onRetry: () => {
                  void routines.refetch();
                },
              }
            : {})}
        />
      ) : (
        <Skeleton label={TRAIN_LOADING_NAME} variant="block" />
      );
    }

    return (
      <>
        {archived.length === 0 ? null : (
          <>
            {isOnline ? null : (
              <p id={offlineLineId} className="px-1 text-caption text-text-muted">
                {ROUTINES_OFFLINE.restore}
              </p>
            )}
            <Card asChild padding="none">
              <ul className="divide-y divide-border">
                {archived.map((routine, index) => (
                  <RoutineActionRow
                    key={routine.id}
                    title={routine.name}
                    subtitle={describeArchivedRoutineMeta({
                      dayCount: routine.summary.dayCount,
                      archivedOn: null,
                    })}
                    actionLabel={ROUTINES_ARCHIVED.restoreAction}
                    actionName={describeRestoreName(routine.name)}
                    actionDescribedBy={offlineLineId}
                    isActionDisabled={!isOnline}
                    actionRef={(button) => {
                      if (button === null) {
                        restoreButtons.current.delete(routine.id);
                      } else {
                        restoreButtons.current.set(routine.id, button);
                      }
                    }}
                    onAction={() => {
                      restoreAndMoveFocus(index);
                    }}
                  />
                ))}
              </ul>
            </Card>
          </>
        )}
        <p className="px-1 text-caption text-text-muted">{ROUTINES_ARCHIVED.note}</p>
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <BackToFoodsLink
        ref={backLink}
        tone="accent"
        label={ROUTINES_ARCHIVED.backLabel}
        href={trainRoutinesPath()}
      />
      <h1 className="text-h1">{ROUTINES_ARCHIVED.title}</h1>
      <div className="flex flex-col gap-3 xl:max-w-[800px]">{renderBody()}</div>
    </div>
  );
}
