"use client";

import { useSessionDetail } from "@keylow/api-client";
import {
  HISTORY_ERROR,
  HISTORY_SCREEN,
  HISTORY_SESSION_NOT_FOUND,
  describeSessionBackLabel,
} from "@keylow/core/copy";
import { History } from "lucide-react";

import { FinishStat } from "../FinishDialog/FinishStat";
import { SetTable } from "../SetTable";
import { SessionDetailLoading } from "./SessionDetailLoading";

import type { SessionDetailScreenProps } from "./types";
import type { SessionDetailContent, SessionDetailView } from "@keylow/api-client";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { trainHistoryPath, trainPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";

function SessionDetailBody({ content }: { content: SessionDetailContent }) {
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
              }))}
            />
          </section>
        </Card>
      ))}
    </>
  );
}

function renderBody(detail: SessionDetailView) {
  switch (detail.status) {
    case "ready":
      return <SessionDetailBody content={detail.content} />;
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
 * read-only tables. The session is read alone, with no routine, so it opens whatever became of the routine it
 * followed. A session that is not found, in whatever way, leads back to the history. Offline with nothing saved
 * is the error state without Try again, never a skeleton that waits for a connection that may not come. The
 * dashboard layout has already sent anyone who has not accepted the current Terms to the accept page, so every
 * read here is behind the terms gate.
 */
export function SessionDetailScreen({ id, origin }: SessionDetailScreenProps) {
  const detail = useSessionDetail(id, { isOnline: useIsOnline(), enabled: true });

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <BackToFoodsLink
        tone="accent"
        label={describeSessionBackLabel(origin)}
        href={origin === "train" ? trainPath() : trainHistoryPath()}
      />
      <h1 className="text-h1">
        {detail.status === "ready" ? detail.content.title : HISTORY_SCREEN.title}
      </h1>
      <div className="flex flex-col gap-3 xl:max-w-[800px]">{renderBody(detail)}</div>
    </div>
  );
}
