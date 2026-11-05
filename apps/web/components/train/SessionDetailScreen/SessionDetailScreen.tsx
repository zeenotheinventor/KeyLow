"use client";

import { useDeleteSession, useEditSet, useSession, useSessionDetail } from "@keylow/api-client";
import {
  HISTORY_DELETE_SESSION,
  HISTORY_ERROR,
  HISTORY_SCREEN,
  HISTORY_SESSION_NOT_FOUND,
  describeDeleteSessionBody,
  describeSessionBackLabel,
} from "@keylow/core/copy";
import { planProgress } from "@keylow/core/training";
import { CircleAlert, History } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { FinishStat } from "../FinishDialog/FinishStat";
import { SetTable } from "../SetTable";
import { DeleteSessionDialog } from "./DeleteSessionDialog";
import { EditSetDialog } from "./EditSetDialog";
import { SessionDetailLoading } from "./SessionDetailLoading";

import type { SessionDetailScreenProps } from "./types";
import type { SessionDetailContent, SessionDetailView } from "@keylow/api-client";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { useSetNotices } from "@/components/train/SessionScreen/useSetNotices";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { trainHistoryPath, trainPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";

function SessionDetailBody({
  content,
  onEditSet,
}: {
  content: SessionDetailContent;
  onEditSet: (setId: string, row: HTMLButtonElement) => void;
}) {
  const { when, stats, exercises } = content;

  return (
    <>
      <p className="text-caption tabular-nums text-text-secondary">{when}</p>
      <div className="grid grid-cols-3 gap-2">
        {[stats.time, stats.sets, stats.exercises].map((stat) => (
          <FinishStat key={stat.label} label={stat.label} value={stat.value} note={stat.note} />
        ))}
      </div>
      {/* The Muscles trained card goes here (KEY-470). */}
      {exercises.map(({ exerciseId, name, note, rows }) => (
        <Card key={exerciseId} asChild padding="none" className="flex flex-col pb-1 pt-3">
          <section aria-label={name}>
            <div className="flex items-baseline justify-between gap-3 px-4 pb-2">
              <h2 className="min-w-0 text-body-strong">{name}</h2>
              {note === null ? null : (
                <span className="shrink-0 text-caption text-text-muted">{note}</span>
              )}
            </div>
            <SetTable
              variant="readOnly"
              rows={rows.map(({ key, setType, copy }) => ({
                key,
                state: "readOnly",
                setType,
                label: copy.label,
                what: copy.what,
                rir: copy.rir,
                name: copy.description,
                edit: {
                  name: copy.accessibleName,
                  onPress: (event) => {
                    onEditSet(key, event.currentTarget);
                  },
                },
              }))}
            />
          </section>
        </Card>
      ))}
    </>
  );
}

function renderBody(
  detail: SessionDetailView,
  onEditSet: (setId: string, row: HTMLButtonElement) => void,
) {
  switch (detail.status) {
    case "ready":
      return <SessionDetailBody content={detail.content} onEditSet={onEditSet} />;
    case "notFound":
      return (
        <EmptyState
          icon={History}
          title={HISTORY_SESSION_NOT_FOUND.title}
          body={HISTORY_SESSION_NOT_FOUND.body}
          action={{ label: HISTORY_SESSION_NOT_FOUND.action, href: trainHistoryPath() }}
        />
      );
    case "error":
      return (
        <ErrorState
          title={HISTORY_ERROR.title}
          body={HISTORY_ERROR.body}
          retryLabel={HISTORY_ERROR.action}
          {...(detail.retry === undefined ? {} : { onRetry: detail.retry })}
        />
      );
    case "loading":
      return <SessionDetailLoading />;
  }
}

/**
 * A logged session, opened from the history, the Train home's week strip or its Done card, as the
 * `history · session-detail` board draws it in the web shell: the routine day's name over when it was, three
 * cards (Time, Sets and Exercises, which state what was done and never compare it with a plan: the board
 * still draws a Plan card, and Zee's ruling of 2026-10-23 overrides it) and the exercises with their sets as
 * tables whose rows are buttons. The session is read alone, with no routine, so it opens whatever became of
 * the routine it followed. A session that is not found, in whatever way, leads back to the history. Offline
 * with nothing saved is the error state without Try again, never a skeleton that waits for a connection that
 * may not come. The dashboard layout has already sent anyone who has not accepted the current Terms to the
 * accept page, so every read here is behind the terms gate.
 *
 * Pressing a set opens the edit set dialog (change it, or delete it with the Undo toast the session page
 * uses), and Delete session in the header asks first and then leaves for the history with `replace`, so Back
 * never reopens a deleted session. The writes are the ones the phone uses (`@keylow/api-client`) and need a
 * connection: offline the controls are off and say why.
 */
export function SessionDetailScreen({ id, origin }: SessionDetailScreenProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const read = useSessionDetail(id, { isOnline, enabled: true });
  const session = useSession(id, { enabled: true });
  const toast = useToast();
  const { notices, prepareRemoval } = useSetNotices();
  const { openSet, edit } = useEditSet(id, { notices, enabled: true });
  const deleteSession = useDeleteSession();
  // Deleting the session takes it out of the cache before the page has left, so what was shown stays until then.
  const [isLeaving, setIsLeaving] = useState(false);
  const [lastContent, setLastContent] = useState<SessionDetailContent | null>(null);
  if (read.status === "ready" && read.content !== lastContent) {
    setLastContent(read.content);
  }
  const detail: SessionDetailView =
    isLeaving && lastContent !== null ? { status: "ready", content: lastContent } : read;
  // The row that opened the edit dialog, which focus goes back to, and where a keyboard Undo starts from.
  const [pressedRow, setPressedRow] = useState<HTMLButtonElement | null>(null);
  // The question keeps its words once asked: the session leaves the cache the moment it is deleted.
  const [question, setQuestion] = useState<string | null>(null);
  // The Delete session control that asked, which focus goes back to when the question closes.
  const [deleteButton, setDeleteButton] = useState<HTMLButtonElement | null>(null);
  const offlineLineId = useId();

  function askToDelete(button: HTMLButtonElement) {
    const loaded = session.data;
    if (loaded === undefined || loaded === null) {
      return;
    }
    const progress = planProgress(null, loaded.sets);
    setDeleteButton(button);
    setQuestion(
      describeDeleteSessionBody({
        setCount: progress.logged === 0 ? progress.warmups : progress.logged,
        dayName: loaded.routine_day_name,
        localDate: loaded.local_date,
      }),
    );
  }

  async function removeSession(): Promise<boolean> {
    setIsLeaving(true);
    try {
      await deleteSession.mutateAsync(id);
    } catch {
      setIsLeaving(false);
      toast.show({ message: HISTORY_DELETE_SESSION.failed, tone: "danger", icon: CircleAlert });
      return false;
    }
    router.replace(trainHistoryPath());
    return true;
  }

  const isReady = detail.status === "ready";

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <BackToFoodsLink
        tone="accent"
        label={describeSessionBackLabel(origin)}
        href={origin === "train" ? trainPath() : trainHistoryPath()}
      />
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-h1">
          {detail.status === "ready" ? detail.content.title : HISTORY_SCREEN.title}
        </h1>
        {isReady ? (
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            disabled={!isOnline}
            aria-describedby={isOnline ? undefined : offlineLineId}
            onClick={(event) => {
              askToDelete(event.currentTarget);
            }}
          >
            {HISTORY_DELETE_SESSION.confirmAction}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 xl:max-w-[800px]">
        {isReady && !isOnline ? (
          <div id={offlineLineId}>
            <Banner tone="info">{HISTORY_DELETE_SESSION.offline}</Banner>
          </div>
        ) : null}
        {renderBody(detail, (setId, row) => {
          setPressedRow(row);
          openSet(setId);
        })}
      </div>
      {edit !== null && edit.isOpen ? (
        <EditSetDialog
          key={edit.openingId}
          entry={edit.entry}
          unit={edit.unit}
          returnFocusTo={pressedRow}
          onSave={edit.save}
          onDelete={() => {
            prepareRemoval({ from: pressedRow });
            return edit.remove();
          }}
          onClose={edit.close}
        />
      ) : null}
      {question === null ? null : (
        <DeleteSessionDialog
          body={question}
          returnFocusTo={deleteButton}
          onConfirm={removeSession}
          onClose={() => {
            setQuestion(null);
          }}
        />
      )}
    </div>
  );
}
