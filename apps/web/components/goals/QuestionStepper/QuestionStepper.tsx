"use client";

import { describeQuestionStep, GOAL_QUESTION_STEPS, GOAL_QUESTIONNAIRE } from "@keylow/core/copy";
import { useEffect, useId, useRef } from "react";

import type { QuestionStepperProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const QUESTION_COUNT = GOAL_QUESTION_STEPS.length;

// The fill is one sixth of the track for each question. The classes are written out whole so Tailwind sees them.
const FILL_CLASSES = ["w-1/6", "w-2/6", "w-3/6", "w-4/6", "w-5/6", "w-full"] as const;

/**
 * What each question of the goal questionnaire sits in, as the web goals board draws it: a card 560 px wide
 * at most, with "Your goal · n of 6" above the progress bar, the title and help line, the answers, the note
 * under them, and a footer at the right with Cancel, Back (from the second question) and Next, which reads
 * "See your priorities" on the sixth. The caller keeps the answers and decides what Cancel, Back and Next
 * do. Focus moves to the title when the step changes, so a keyboard or screen reader user starts at the
 * question.
 */
export function QuestionStepper({
  step,
  title,
  help,
  note,
  isNextEnabled,
  onCancel,
  onBack,
  onNext,
  children,
}: QuestionStepperProps) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const nextLabel =
    step === QUESTION_COUNT ? GOAL_QUESTIONNAIRE.finalAction : GOAL_QUESTIONNAIRE.nextAction;

  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);

  return (
    <Card asChild padding="none">
      <section
        aria-labelledby={titleId}
        className="mx-auto flex w-full max-w-[560px] flex-col gap-3 p-4 min-[700px]:p-8"
      >
        <span className="text-caption tabular-nums text-text-secondary">
          {describeQuestionStep(step)}
        </span>
        <div
          role="progressbar"
          aria-label={GOAL_QUESTIONNAIRE.progressName}
          aria-valuemin={0}
          aria-valuemax={QUESTION_COUNT}
          aria-valuenow={step}
          className="h-1 overflow-hidden rounded-[2px] bg-surface-raised"
        >
          <span className={`block h-1 bg-accent ${FILL_CLASSES[step - 1] ?? "w-0"}`} />
        </div>
        <h1 ref={titleRef} id={titleId} tabIndex={-1} className="mt-2 text-h1 outline-none">
          {title}
        </h1>
        <p className="text-body text-text-secondary">{help}</p>
        {children}
        {note === null ? null : <p className="text-caption text-text-muted">{note}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {GOAL_QUESTIONNAIRE.cancelAction}
          </Button>
          {onBack === undefined ? null : (
            <Button variant="secondary" onClick={onBack}>
              {GOAL_QUESTIONNAIRE.backAction}
            </Button>
          )}
          <Button disabled={!isNextEnabled} onClick={onNext}>
            {nextLabel}
          </Button>
        </div>
      </section>
    </Card>
  );
}
