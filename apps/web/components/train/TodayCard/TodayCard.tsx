import { TRAIN_HOME, TRAIN_PICK_DAY, describeTodayCard } from "@keylow/core/copy";

import { ExerciseRowsLoading } from "./ExerciseRowsLoading";
import { SetsProgressBar } from "./SetsProgressBar";

import type { TodayCardProps } from "./types";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/** The buttons that start a session, in a row from the medium width and stacked below it. Nothing is drawn when none is given. */
const actionRow = (startButton: ReactNode, pickDayButton: ReactNode) =>
  startButton === null && pickDayButton === null ? null : (
    <div className="mt-3 flex flex-col gap-2 md:flex-row md:gap-3">
      {startButton}
      {pickDayButton}
    </div>
  );

/**
 * The Train home's Today card in its four states, as the `web-train · today` board draws the planned one and
 * the `train · in-progress` and `train · rest-day` boards the others: the planned day with its exercises and
 * Start, the session in progress with its sets and Resume, the finished session with View session, and the
 * rest day with the next day. Every word is core's (`describeTodayCard`). A button is drawn only when its
 * handler is given, so none is a dead control. Start, Resume, Log another session, Log a session and Pick
 * day are dimmed when `isStartAndResumeDisabled`, and View session is not, since it reads what is saved.
 * Pick day is a secondary button that KEY-505's waiver leaves undrawn on the board, beside Start on the
 * planned card and beside Log another session and Log a session on the done and rest cards.
 */
export function TodayCard({
  card,
  context,
  exercises = [],
  isLoadingExercises = false,
  isStartAndResumeDisabled,
  isStarting = false,
  onStart,
  onResume,
  resumeButtonRef,
  onViewSession,
  onLogAnother,
  onLogSession,
  onPickDay,
}: TodayCardProps) {
  const copy = describeTodayCard(card, context);
  const madeUpLine =
    (copy.kind === "planned" || copy.kind === "rest") && copy.madeUpLine !== undefined ? (
      <p className="text-caption text-text-secondary">{copy.madeUpLine}</p>
    ) : null;
  // Pick day is secondary, so Start stays the one primary action. Where the card has a button to start, it sits
  // beside it from the medium width and under it below, as two buttons of the same width on the phone.
  const pickDay =
    onPickDay === undefined ? null : (
      <Button
        disabled={isStartAndResumeDisabled}
        loading={isStarting}
        variant="secondary"
        onClick={onPickDay}
      >
        {TRAIN_PICK_DAY.action}
      </Button>
    );

  return (
    <Card asChild padding="none" className="p-5">
      <section aria-label={TRAIN_HOME.todaySectionName} className="flex flex-col gap-1">
        <p className="text-caption text-text-muted">{copy.heading}</p>
        {copy.kind === "planned" ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="min-w-0 text-h2">{copy.title}</h2>
              <span className="shrink-0 text-caption text-text-secondary">{copy.dayLine}</span>
            </div>
            <p className="text-caption tabular-nums text-text-secondary">{copy.loadLine}</p>
            {madeUpLine}
            {isLoadingExercises && card.kind === "planned" ? (
              <ExerciseRowsLoading count={card.exerciseCount} />
            ) : null}
            {exercises.length === 0 ? null : (
              <ul className="mt-2 flex flex-col">
                {exercises.map((exercise) => (
                  <li
                    key={exercise.id}
                    className="box-content flex min-h-9 items-center justify-between gap-3 border-t border-border"
                  >
                    <span className="min-w-0 text-body">{exercise.name}</span>
                    <span className="shrink-0 text-caption tabular-nums text-text-secondary">
                      {exercise.target}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {actionRow(
              onStart === undefined ? null : (
                <Button disabled={isStartAndResumeDisabled} loading={isStarting} onClick={onStart}>
                  {copy.action}
                </Button>
              ),
              pickDay,
            )}
          </>
        ) : null}
        {copy.kind === "in_progress" ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="min-w-0 text-h2">{copy.title}</h2>
              <Badge
                dot
                tone="accent"
                // The board's swatch is a rounded square, 10 px with a 3 px radius, which no token names.
                className="[&>[aria-hidden]]:size-2.5 [&>[aria-hidden]]:rounded-[3px]"
              >
                {copy.statusLabel}
              </Badge>
            </div>
            <p className="text-caption tabular-nums text-text-secondary">{copy.summaryLine}</p>
            {card.kind === "in_progress" && card.setsPlanned > 0 ? (
              <SetsProgressBar setsLogged={card.setsLogged} setsPlanned={card.setsPlanned} />
            ) : null}
            {onResume === undefined ? null : (
              <Button
                className="mt-3 md:self-start"
                disabled={isStartAndResumeDisabled}
                ref={resumeButtonRef}
                onClick={onResume}
              >
                {copy.action}
              </Button>
            )}
          </>
        ) : null}
        {copy.kind === "done" ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="min-w-0 text-h2">{copy.title}</h2>
              <Badge dot tone="success">
                {copy.statusLabel}
              </Badge>
            </div>
            <p className="text-caption tabular-nums text-text-secondary">{copy.summaryLine}</p>
            {onViewSession === undefined ? null : (
              <Button
                className="-ml-3 mt-2 self-start text-accent-ink"
                size="sm"
                variant="ghost"
                onClick={onViewSession}
              >
                {copy.action}
              </Button>
            )}
            {actionRow(
              onLogAnother === undefined ? null : (
                <Button
                  variant="secondary"
                  disabled={isStartAndResumeDisabled}
                  loading={isStarting}
                  onClick={onLogAnother}
                >
                  {copy.logAnotherAction}
                </Button>
              ),
              pickDay,
            )}
          </>
        ) : null}
        {copy.kind === "rest" ? (
          <>
            <h2 className="text-h2">{copy.title}</h2>
            {copy.body === null ? null : (
              <p className="text-body text-text-secondary">{copy.body}</p>
            )}
            {madeUpLine}
            {actionRow(
              onLogSession === undefined ? null : (
                <Button
                  variant="secondary"
                  disabled={isStartAndResumeDisabled}
                  loading={isStarting}
                  onClick={onLogSession}
                >
                  {copy.logSessionAction}
                </Button>
              ),
              pickDay,
            )}
          </>
        ) : null}
      </section>
    </Card>
  );
}
