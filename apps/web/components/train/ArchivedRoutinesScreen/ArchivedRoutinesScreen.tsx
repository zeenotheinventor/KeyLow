"use client";

import { useRoutines } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINES_ARCHIVED,
  TRAIN_LOADING_NAME,
  describeArchivedRoutineMeta,
} from "@keylow/core/copy";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { ListRow } from "@/components/ui/ListRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { trainRoutinesPath } from "@/lib/trainRoutes";

/**
 * The archived routines, as the `routines · archived` board draws them in the web shell: Back to Routines
 * and the title, a card of the routines and a note on what archived means. They are read from the list's
 * one request, which brings them with the live routines. A row is plain information, because an archived
 * routine is restored before it is opened, and the database does not keep the day it was archived, so a
 * row gives its days alone.
 */
export function ArchivedRoutinesScreen() {
  const routines = useRoutines({ archived: true });
  const archived = routines.data?.filter((routine) => routine.is_archived) ?? [];

  function renderBody() {
    if (routines.data === undefined) {
      return routines.isError ? (
        <ErrorState
          title={GENERIC_ERROR}
          retryLabel={RETRY_LABEL}
          onRetry={() => {
            void routines.refetch();
          }}
        />
      ) : (
        <Skeleton label={TRAIN_LOADING_NAME} variant="block" />
      );
    }

    return (
      <>
        {archived.length === 0 ? null : (
          <Card asChild padding="none">
            <ul className="divide-y divide-border">
              {archived.map((routine) => (
                <ListRow
                  key={routine.id}
                  className="min-h-[64px]"
                  title={routine.name}
                  subtitle={describeArchivedRoutineMeta({
                    dayCount: routine.summary.dayCount,
                    archivedOn: null,
                  })}
                />
              ))}
            </ul>
          </Card>
        )}
        <p className="px-1 text-caption text-text-muted">{ROUTINES_ARCHIVED.note}</p>
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <BackToFoodsLink
        tone="accent"
        label={ROUTINES_ARCHIVED.backLabel}
        href={trainRoutinesPath()}
      />
      <h1 className="text-h1">{ROUTINES_ARCHIVED.title}</h1>
      <div className="flex flex-col gap-3 xl:max-w-[800px]">{renderBody()}</div>
    </div>
  );
}
