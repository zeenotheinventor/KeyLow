"use client";

import { describeGoalAnswerRows, GOAL_SCREEN } from "@keylow/core/copy";
import { goalAnswersOfRow } from "@keylow/core/training";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef } from "react";

import { GoalAnswerRow } from "../GoalAnswerRow";
import { useGoalDraft } from "../GoalDraftProvider";

import type { GoalScreenProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { goalExitPath, goalQuestionPath, goalSummaryPath } from "@/lib/goalRoutes";
import { trainPath } from "@/lib/trainRoutes";
import { useGoalSetOn } from "@/lib/useGoalSetOn";

/**
 * "Goal", the page the Goal row of More opens once a goal is stored, as `goals · edit` draws it: the six
 * answers as rows that each open their question, the note that changing one starts a new goal from today,
 * See your priorities, and the day the goal was set. A row reopens the questionnaire at its question with
 * every answer filled, and finishing walks on to the summary, where Save goal stores a new goal and the
 * person comes back here. See your priorities opens that summary for the answers as stored, with nothing to
 * save. Every time this page is in front the draft starts over from the stored goal, so an answer changed
 * and not saved is dropped, and a goal just saved is what the next change is counted against. The rows and
 * See your priorities carry Train as the origin when Train opened the page, so the flow leaves for Train and
 * not for More. The day is not drawn until the profile's time zone is read, so it does not show and then
 * change. Back returns to Train when Train opened the page and to More otherwise, by replacing the address
 * so that Back in the browser does not return here.
 */
export function GoalScreen({ goal, isFromTrain }: GoalScreenProps) {
  const router = useRouter();
  const { restart } = useGoalDraft();
  const setOn = useGoalSetOn(goal);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    restart(goalAnswersOfRow(goal));
  }, [restart, goal]);

  // The page opens at its title, as each question does.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby={titleId} className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
      <header className="flex items-center gap-2">
        <IconButton
          icon={ChevronLeft}
          size="card"
          label={GOAL_SCREEN.backLabel}
          onClick={() => {
            router.replace(isFromTrain ? trainPath() : goalExitPath());
          }}
        />
        <h1
          ref={titleRef}
          id={titleId}
          tabIndex={-1}
          className="flex-1 text-center text-h2 outline-none"
        >
          {GOAL_SCREEN.title}
        </h1>
        <span aria-hidden className="size-10 shrink-0" />
      </header>
      <Card asChild padding="none">
        <ul className="divide-y divide-border">
          {describeGoalAnswerRows(goal).map((row, index) => (
            <GoalAnswerRow
              key={row.step}
              label={row.label}
              name={row.name}
              value={row.value}
              href={goalQuestionPath(index + 1, { fromGoalPage: true, fromTrain: isFromTrain })}
            />
          ))}
        </ul>
      </Card>
      <p className="px-1 text-caption text-text-muted">{GOAL_SCREEN.changeNote}</p>
      <Button asChild variant="secondary" className="w-full">
        <Link href={goalSummaryPath({ fromTrain: isFromTrain })}>
          {GOAL_SCREEN.prioritiesAction}
        </Link>
      </Button>
      {setOn === undefined ? null : (
        <span className="px-1 text-caption text-text-muted">{setOn}</span>
      )}
    </section>
  );
}
