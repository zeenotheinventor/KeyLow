"use client";

import {
  describeFinishDetails,
  useSessionView,
  usePendingSets,
  useSetLogging,
} from "@keylow/api-client";
import {
  FINISH_SCREEN,
  SESSION_ACTIVE,
  SESSION_DISCARD,
  TRAIN_ERROR,
  TRAIN_LOADING_NAME,
} from "@keylow/core/copy";
import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { AddExerciseDialog } from "../AddExerciseDialog";
import { FinishDialog } from "../FinishDialog";
import { DiscardSessionDialog } from "./DiscardSessionDialog";
import { SessionClock } from "./SessionClock";
import { SessionExerciseCard } from "./SessionExerciseCard";
import { useSetNotices } from "./useSetNotices";

import type { FinishDetails, RemoveSetRequest } from "@keylow/api-client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { trainPath } from "@/lib/trainRoutes";

/**
 * The session in progress, as the `web-session · active` board draws it: the session's name with its clock
 * and sets logged, Discard session and Finish in the header, a card for each exercise with its table of sets, and Add
 * exercise, which opens the dialog that puts another exercise's card on the page. The
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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // What the finish dialog was opened with, which it keeps while the saved session stops being the open one.
  const [finishing, setFinishing] = useState<FinishDetails | null>(null);
  // Held here, so Keep logging does not drop a note of up to 1,000 characters.
  const [note, setNote] = useState("");
  const toast = useToast();
  const nothingLoggedHintId = useId();

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

  const hasNothingLogged = view.progress.logged + view.progress.warmups === 0;
  // A set whose insert has not landed is counted on the finish dialog, and Save would end the session before it is stored.
  const hasSetBeingSaved = pendingSets.sets.some(({ savedId }) => savedId === null);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SessionClock {...view.header} />
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsDiscardOpen(true);
            }}
          >
            {SESSION_DISCARD.confirmAction}
          </Button>
          <Button
            size="sm"
            disabled={hasNothingLogged || hasSetBeingSaved}
            aria-describedby={hasNothingLogged ? nothingLoggedHintId : undefined}
            onClick={() => {
              setFinishing(
                describeFinishDetails(
                  { id: view.sessionId, started_at: view.header.startedAt, sets: view.sets },
                  view.header.dayName,
                  view.progress,
                  view.plannedNames,
                ),
              );
            }}
          >
            {SESSION_ACTIVE.finishAction}
          </Button>
        </div>
      </div>
      {hasNothingLogged ? (
        <p id={nothingLoggedHintId} className="text-caption text-text-secondary">
          {FINISH_SCREEN.nothingLoggedHint}
        </p>
      ) : null}
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
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setIsPickerOpen(true);
          }}
        >
          <Plus aria-hidden />
          {SESSION_ACTIVE.addExerciseAction}
        </Button>
      </div>
      <AddExerciseDialog
        open={isPickerOpen}
        mode="session"
        onAddToSession={view.addExercise}
        onClose={() => {
          setIsPickerOpen(false);
        }}
      />
      {finishing === null ? null : (
        <FinishDialog
          details={finishing}
          note={note}
          onChangeNote={setNote}
          onKeepLogging={() => {
            setFinishing(null);
          }}
          onSaved={() => {
            toast.show({ message: FINISH_SCREEN.savedToast, tone: "success", icon: Check });
          }}
        />
      )}
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
