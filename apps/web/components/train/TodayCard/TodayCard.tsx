import { TRAIN_HOME, describeTodayCard } from "@keylow/core/copy";

import { ExerciseRowsLoading } from "./ExerciseRowsLoading";
import { SetsProgressBar } from "./SetsProgressBar";

import type { TodayCardProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * The Train home's Today card in its four states, as the `web-train · today` board draws the planned one and
 * the `train · in-progress` and `train · rest-day` boards the others: the planned day with its exercises and
 * Start, the session in progress with its sets and Resume, the finished session with View session, and the
 * rest day with the next day. Every word is core's (`describeTodayCard`). A button is drawn only when its
 * handler is given, so none is a dead control. Start, Resume, Log another session and Log a session are
 * dimmed when `isStartAndResumeDisabled`, and View session is not, since it reads what is saved.
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
  onViewSession,
  onLogAnother,
  onLogSession,
}: TodayCardProps) {
  const copy = describeTodayCard(card, context);
  const madeUpLine =
    (copy.kind === "planned" || copy.kind === "rest") && copy.madeUpLine !== undefined ? (
      <p className="text-caption text-text-secondary">{copy.madeUpLine}</p>
    ) : null;

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
            {onStart === undefined ? null : (
              <Button
                className="mt-3 md:self-start"
                disabled={isStartAndResumeDisabled}
                loading={isStarting}
                onClick={onStart}
              >
                {copy.action}
              </Button>
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
            {onLogAnother === undefined ? null : (
              <Button
                className="mt-3 md:self-start"
                variant="secondary"
                disabled={isStartAndResumeDisabled}
                loading={isStarting}
                onClick={onLogAnother}
              >
                {copy.logAnotherAction}
              </Button>
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
            {onLogSession === undefined ? null : (
              <Button
                className="mt-3 md:self-start"
                variant="secondary"
                disabled={isStartAndResumeDisabled}
                loading={isStarting}
                onClick={onLogSession}
              >
                {copy.logSessionAction}
              </Button>
            )}
          </>
        ) : null}
      </section>
    </Card>
  );
}
