"use client";

import { useRoutine, useTrainHome } from "@keylow/api-client";
import {
  TRAIN_ERROR,
  TRAIN_HOME,
  TRAIN_OFFLINE_NOTHING_SAVED,
  TRAIN_OFFLINE_TITLE,
  describeOfflineBanner,
} from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { WifiOff } from "lucide-react";
import Link from "next/link";

import { PlanWeek } from "../PlanWeek";
import { TodayCard } from "../TodayCard";
import { TrainBodyMap } from "../TrainBodyMap";
import { TrainFirstTime } from "../TrainFirstTime";
import { TrainLoading } from "../TrainLoading";
import { TrainNoRoutine } from "../TrainNoRoutine";
import { plannedExercisesOf } from "./plannedExercises";

import type { TrainScreenProps, TrainSessionStart } from "./types";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { trainHistoryPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/** The handler a button calls, with what the start needs. No handler means no button, so none is drawn. */
function bindStart(
  handler: ((start: TrainSessionStart) => void) | undefined,
  start: TrainSessionStart,
): (() => void) | undefined {
  return handler === undefined
    ? undefined
    : () => {
        handler(start);
      };
}

/** The handler of View session, given the session it opens. */
function bindViewSession(handler: (sessionId: string) => void, sessionId: string): () => void {
  return () => {
    handler(sessionId);
  };
}

/**
 * The Train page: the Today card, or the first visit or no routine card when today has no card, under the
 * title, as the `web-train · today` board and the `train · *` state boards draw them. The dashboard layout
 * has already sent anyone who has not accepted the current Terms to the accept page, so every read here is
 * behind the terms gate. Offline it shows what the page already holds, under a notice that says when.
 * Starting a session needs a connection, so the buttons that log or reopen one are dimmed offline. A button
 * is drawn only when its handler is given, and it passes the handler what the start needs: the routine day
 * and the time zone. The page is a row from the extra large breakpoint, as the board draws it: the Today
 * card and the week in the left column and the body map in a column of its own at 360 pixels, which
 * stacks under them below it. The body map is left out on the first visit.
 */
export function TrainScreen({
  isStarting = false,
  onLogSession,
  onCreateRoutine,
  onSetGoal,
  onStart,
  onResume,
  onViewSession,
}: TrainScreenProps) {
  const home = useTrainHome({ now: useNow(), enabled: true });
  const isOnline = useIsOnline();
  // The board lists the planned day's exercises with their reps, which the active routine's read does not hold.
  const plannedRoutineId =
    home.status === "ready" &&
    home.today?.card.kind === "planned" &&
    home.today.plannedDayId !== null
      ? (home.routineId ?? undefined)
      : undefined;
  const routine = useRoutine(plannedRoutineId);

  const title = (
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-h1">{TRAIN_HOME.title}</h1>
      <div className="flex gap-2">
        <Button asChild className="text-label-small" size="sm" variant="secondary">
          <Link href={trainHistoryPath()}>{TRAIN_HOME.historyLink}</Link>
        </Button>
      </div>
    </div>
  );

  if (home.status === "error") {
    return (
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
        {title}
        <ErrorState
          title={TRAIN_ERROR.title}
          body={TRAIN_ERROR.body}
          retryLabel={TRAIN_ERROR.action}
          onRetry={home.retry}
        />
      </div>
    );
  }

  // The first visit has nothing to show on a body map, as on the phone.
  const isFirstTime =
    home.status === "ready" && home.today === null && !home.hasRoutine && !home.hasLoggedSession;
  const freeStart =
    home.status === "ready" ? { routineDayId: null, timeZone: home.timeZone } : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      {title}
      {isOnline ? null : (
        <Banner tone="review" role="status" icon={WifiOff} title={TRAIN_OFFLINE_TITLE}>
          {home.status === "ready"
            ? describeOfflineBanner(formatClockTime(home.savedAt, home.timeZone))
            : TRAIN_OFFLINE_NOTHING_SAVED}
        </Banner>
      )}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-5">
        <div className="flex min-w-0 flex-col gap-3 xl:max-w-[800px] xl:flex-1 xl:gap-5">
          {home.status === "loading" ? <TrainLoading /> : null}
          {home.status === "ready" && home.today !== null && freeStart !== undefined ? (
            <TodayCard
              card={home.today.card}
              context={home.today.context}
              exercises={plannedExercisesOf(routine.data, home.today.plannedDayId)}
              isLoadingExercises={routine.isLoading}
              isStarting={isStarting}
              isStartAndResumeDisabled={!isOnline}
              onResume={onResume}
              onStart={
                home.today.plannedDayId === null
                  ? undefined
                  : bindStart(onStart, {
                      routineDayId: home.today.plannedDayId,
                      timeZone: home.timeZone,
                    })
              }
              onLogAnother={bindStart(onLogSession, freeStart)}
              onLogSession={bindStart(onLogSession, freeStart)}
              onViewSession={
                onViewSession === undefined || home.today.sessionToViewId === null
                  ? undefined
                  : bindViewSession(onViewSession, home.today.sessionToViewId)
              }
            />
          ) : null}
          {home.status === "ready" && home.today === null && !home.hasRoutine ? (
            home.hasLoggedSession ? (
              <TrainNoRoutine
                isLogDisabled={!isOnline}
                isStarting={isStarting}
                onCreateRoutine={onCreateRoutine}
                onLogSession={bindStart(onLogSession, {
                  routineDayId: null,
                  timeZone: home.timeZone,
                })}
              />
            ) : (
              <TrainFirstTime
                isLogDisabled={!isOnline}
                isStarting={isStarting}
                onLogSession={bindStart(onLogSession, {
                  routineDayId: null,
                  timeZone: home.timeZone,
                })}
                onSetGoal={onSetGoal}
              />
            )
          ) : null}
          {home.status === "ready" && home.week !== null ? (
            <PlanWeek week={home.week.plan} weekStart={home.week.weekStart} />
          ) : null}
        </div>
        {home.status === "ready" && !isFirstTime ? (
          <div className="xl:w-[360px] xl:shrink-0">
            <TrainBodyMap savedAt={home.savedAt} timeZone={home.timeZone} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
