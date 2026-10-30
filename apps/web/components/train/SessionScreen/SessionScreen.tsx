"use client";

import { useSessionView, usePendingSets, useSetLogging } from "@keylow/api-client";
import { SESSION_DISCARD, TRAIN_ERROR, TRAIN_LOADING_NAME } from "@keylow/core/copy";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DiscardSessionDialog } from "./DiscardSessionDialog";
import { SessionClock } from "./SessionClock";
import { SessionExerciseCard } from "./SessionExerciseCard";
import { useSetNotices } from "./useSetNotices";

import type { RemoveSetRequest } from "@keylow/api-client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { trainPath } from "@/lib/trainRoutes";

/**
 * The session in progress, as the `web-session · active` board draws it: the session's name with its clock
 * and sets logged, Discard session in the header, and a card for each exercise with its table of sets. The
 * dashboard layout has already sent anyone who has not accepted the current Terms to the accept page, so
 * every read here is behind the terms gate. The logging, the removing with Undo and the discard are the
 * ones the phone uses (`@keylow/api-client`), and this page draws them. With no session in progress, which is
 * also what a discard leaves, it goes back to the Train home.
 */
export function SessionScreen() {
  const router = useRouter();
  const pendingSets = usePendingSets();
  const view = useSessionView({ enabled: true }, pendingSets.sets);
  const { notices, prepareRemoval } = useSetNotices();
  const setLogging = useSetLogging(view, pendingSets, notices);
  const logging = {
    ...setLogging,
    removeSet: (request: RemoveSetRequest) => {
      prepareRemoval();
      setLogging.removeSet(request);
    },
  };
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  useEffect(() => {
    if (view.status === "none") {
      router.replace(trainPath());
    }
  }, [view.status, router]);

  if (view.status === "error") {
    return (
      <ErrorState
        title={TRAIN_ERROR.title}
        body={TRAIN_ERROR.body}
        retryLabel={TRAIN_ERROR.action}
        onRetry={view.retry}
      />
    );
  }
  if (view.status !== "ready") {
    return (
      <Skeleton label={TRAIN_LOADING_NAME}>
        <Card padding="none" className="flex flex-col gap-2 p-5">
          <SkeletonBone className="h-6 w-[96px]" />
          <SkeletonBone className="h-3 w-[160px]" />
        </Card>
      </Skeleton>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <div className="flex items-center justify-between gap-3">
        <SessionClock {...view.header} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setIsDiscardOpen(true);
          }}
        >
          {SESSION_DISCARD.confirmAction}
        </Button>
      </div>
      <div className="flex flex-col gap-3 xl:max-w-[800px] xl:gap-5">
        {view.exercises.map(({ name, target, plan, exercise }) => (
          <SessionExerciseCard
            key={exercise.exerciseId}
            sessionId={view.sessionId}
            name={name}
            target={target}
            plan={plan}
            unit={view.unit}
            exercise={exercise}
            sessionSets={view.sets}
            logging={logging}
          />
        ))}
      </div>
      <DiscardSessionDialog
        open={isDiscardOpen}
        sessionId={view.sessionId}
        dayName={view.header.dayName}
        sets={view.sets}
        onClose={() => {
          setIsDiscardOpen(false);
        }}
        onDiscarded={() => {
          router.replace(trainPath());
        }}
      />
    </div>
  );
}
