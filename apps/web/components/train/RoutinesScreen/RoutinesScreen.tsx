"use client";

import { useMakeRoutineActive, useProfileTimeZone, useRoutines } from "@keylow/api-client";
import {
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINES_EMPTY,
  ROUTINES_OFFLINE,
  ROUTINES_SCREEN,
  TRAIN_LOADING_NAME,
  describeArchivedRoutinesLink,
  describeMakeActiveDialog,
  describeMakeActiveName,
  describeOtherRoutineMeta,
} from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { iconStroke } from "@keylow/tokens";
import { Archive, Calendar, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { RoutineActionRow } from "../RoutineActionRow";
import { RoutineCard } from "../RoutineCard";
import { useRoutineNotices } from "../useRoutineNotices";
import { activeFromOf, routineItemOf } from "./routineItems";
import { RoutineProgressSection } from "./RoutineProgressSection";

import type { RoutineRef, RoutinesScreenProps } from "./types";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GroupedList } from "@/components/ui/GroupedList";
import { Skeleton } from "@/components/ui/Skeleton";
import { trainPath, trainRoutinesArchivedPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The routines list, as the `routines · list` and `routines · empty` boards draw it in the web shell: Back to
 * Train and the title, the active routine as a card, the other routines in a card of rows, and the link to
 * the archived routines. With no routine it shows the empty state. The list is read with the archived
 * routines in one request, so the archived page opened from here already has them. The date the active
 * routine began is in the profile's time zone, and the list does not wait for the zone: until it is known
 * the date is left out. New routine, Create routine and the routines that open an editor are drawn only
 * when their handlers are given, so none is a dead control. For the active routine the Progress section
 * follows the list, as the `web-train · routines-progress` boards draw it: a second column beside the list
 * from the extra large breakpoint, so the title row spans the page, and under the list below it.
 *
 * Make active on an other routine asks first, as the `routines · set-active` board draws it, with today in
 * the profile's zone: the routine plans from that day. Until the zone is known the question cannot name the
 * day, so Make active is not drawn. Offline the button is off and a line says why, because a write is never
 * held back to run later.
 */
export function RoutinesScreen({ onCreateRoutine, onEditRoutine }: RoutinesScreenProps) {
  const isOnline = useIsOnline();
  const routines = useRoutines({ archived: true });
  const timeZone = useProfileTimeZone();
  const now = useNow();
  const notices = useRoutineNotices();
  const makeActive = useMakeRoutineActive<RoutineRef>(notices);
  // The button that opened the question, so Escape and Cancel return focus to it in every browser (Safari does not focus a button on click).
  const [askedFrom, setAskedFrom] = useState<HTMLElement | null>(null);
  const offlineLineId = useId();
  // The routine just made active. Focus goes to its card once the list shows it there, because the button that was pressed is gone.
  const [focusActiveId, setFocusActiveId] = useState<string | null>(null);
  const activeCardRef = useRef<HTMLButtonElement>(null);
  const activeHeadingRef = useRef<HTMLHeadingElement>(null);
  // The routine whose card has already been given focus, so the effect below moves focus once and never sets state.
  const focusedActiveId = useRef<string | null>(null);

  const live = routines.data?.filter((routine) => !routine.is_archived) ?? [];
  const active = live.find((routine) => routine.is_active);
  const others = live.filter((routine) => routine !== active).map(routineItemOf);
  const activeId = active?.id;

  useEffect(() => {
    if (
      focusActiveId !== null &&
      activeId === focusActiveId &&
      focusedActiveId.current !== focusActiveId
    ) {
      focusedActiveId.current = focusActiveId;
      (activeCardRef.current ?? activeHeadingRef.current)?.focus();
    }
  }, [focusActiveId, activeId]);

  const archivedCount = (routines.data?.length ?? 0) - live.length;
  // Until the zone is known the question cannot name today, so Make active is not drawn.
  const zone = timeZone.data === undefined ? null : (timeZone.data ?? "UTC");
  const localDate = zone === null ? null : toLocalDate(now, zone);

  const title = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-h1">{ROUTINES_SCREEN.title}</h1>
      {onCreateRoutine === undefined || (active === undefined && others.length === 0) ? null : (
        <Button variant="secondary" onClick={onCreateRoutine}>
          <Plus aria-hidden strokeWidth={iconStroke} />
          {ROUTINES_SCREEN.newRoutineLabel}
        </Button>
      )}
    </div>
  );

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
        {active === undefined && others.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title={ROUTINES_EMPTY.title}
            body={ROUTINES_EMPTY.body}
            action={
              onCreateRoutine === undefined
                ? undefined
                : {
                    label: ROUTINES_EMPTY.action,
                    icon: Plus,
                    variant: "primary",
                    onClick: onCreateRoutine,
                  }
            }
          />
        ) : null}
        {active === undefined ? null : (
          <div className="flex flex-col gap-2">
            <h2
              ref={activeHeadingRef}
              tabIndex={-1}
              className="flex min-h-[32px] items-center px-1 text-body-strong outline-none"
            >
              {ROUTINES_SCREEN.activeLabel}
            </h2>
            <RoutineCard
              {...routineItemOf(active)}
              ref={activeCardRef}
              activeFrom={activeFromOf(active, timeZone.data)}
              onPress={
                onEditRoutine === undefined
                  ? undefined
                  : () => {
                      onEditRoutine({ id: active.id, name: active.name });
                    }
              }
            />
          </div>
        )}
        {others.length === 0 ? null : (
          <GroupedList
            title={ROUTINES_SCREEN.otherSectionName}
            notice={
              isOnline || localDate === null ? undefined : (
                <p id={offlineLineId} className="px-1 text-caption text-text-muted">
                  {ROUTINES_OFFLINE.makeActive}
                </p>
              )
            }
          >
            {others.map((routine) => (
              <RoutineActionRow
                key={routine.id}
                title={routine.name}
                subtitle={describeOtherRoutineMeta(routine)}
                actionLabel={ROUTINES_SCREEN.makeActiveAction}
                actionName={describeMakeActiveName(routine.name)}
                actionDescribedBy={offlineLineId}
                isActionDisabled={!isOnline}
                {...(localDate === null
                  ? {}
                  : {
                      onAction: (button) => {
                        setAskedFrom(button);
                        makeActive.ask(
                          { id: routine.id, name: routine.name },
                          describeMakeActiveDialog({
                            routineName: routine.name,
                            previousActiveName: active?.name ?? null,
                            localDate,
                          }),
                        );
                      },
                    })}
                {...(onEditRoutine === undefined
                  ? {}
                  : {
                      onOpen: () => {
                        onEditRoutine({ id: routine.id, name: routine.name });
                      },
                    })}
              />
            ))}
          </GroupedList>
        )}
        {archivedCount === 0 ? null : (
          <Button asChild variant="ghost" className="self-start">
            <Link href={trainRoutinesArchivedPath()}>
              <Archive aria-hidden strokeWidth={iconStroke} />
              {describeArchivedRoutinesLink(archivedCount)}
            </Link>
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <BackToFoodsLink tone="accent" label={ROUTINES_SCREEN.backLabel} href={trainPath()} />
      {title}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-5">
        <div className="flex min-w-0 flex-col gap-4 xl:max-w-[800px] xl:flex-1">{renderBody()}</div>
        {active === undefined ? null : <RoutineProgressSection routineId={active.id} />}
      </div>
      {makeActive.question === null ? null : (
        <Dialog
          open={makeActive.isOpen}
          title={makeActive.question.copy.title}
          className="min-[700px]:w-[440px]"
          returnFocusTo={askedFrom}
          onClose={makeActive.cancel}
          footer={
            <>
              <Button variant="secondary" disabled={makeActive.isBusy} onClick={makeActive.cancel}>
                {makeActive.question.copy.cancelAction}
              </Button>
              <Button
                loading={makeActive.isBusy}
                disabled={!isOnline}
                onClick={() => {
                  const asked = makeActive.question?.routine.id;
                  void makeActive.confirm().then((isActive) => {
                    if (isActive && asked !== undefined) {
                      focusedActiveId.current = null;
                      setFocusActiveId(asked);
                    }
                  });
                }}
              >
                {makeActive.question.copy.confirmAction}
              </Button>
            </>
          }
        >
          <p className="text-body text-text-secondary">{makeActive.question.copy.body}</p>
          {isOnline ? null : (
            <p className="mt-3 text-caption text-text-muted">{ROUTINES_OFFLINE.makeActive}</p>
          )}
        </Dialog>
      )}
    </div>
  );
}
