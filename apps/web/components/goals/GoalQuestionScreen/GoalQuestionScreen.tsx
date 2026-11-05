"use client";

import { GOAL_QUESTION_STEPS, GOAL_QUESTIONS } from "@keylow/core/copy";
import { isGoalStepAnswered } from "@keylow/core/training";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CloseGoalDialog } from "../CloseGoalDialog";
import { DaysStep } from "../DaysStep";
import { EquipmentStep } from "../EquipmentStep";
import { ExperienceStep } from "../ExperienceStep";
import { FocusStep } from "../FocusStep";
import { useGoalDraft } from "../GoalDraftProvider";
import { GoalStep } from "../GoalStep";
import { MinutesStep } from "../MinutesStep";
import { QuestionStepper } from "../QuestionStepper";

import type { GoalQuestionScreenProps } from "./types";

import { goalLeavePath, goalQuestionPath, goalSummaryPath } from "@/lib/goalRoutes";

/**
 * One question of the goal questionnaire. The answers are kept by the flow's layout, so Back loses none. Back
 * goes one step back in the history when the address says a row of the Goal page opened this question, or
 * Next from one that it opened: the question before it, or the Goal page. Any other question, reached cold or
 * after a cancel, goes to the question before it. Cancel asks first when
 * the answers differ from those the flow opened with, so there is something to lose, and leaves for the Goal
 * page when a goal was stored and for More when it is the first. The phone leaves the whole flow for More from
 * any question. Here that would throw a person out of the page they were changing a row on.
 * Next on the sixth question opens the summary, which saves.
 */
export function GoalQuestionScreen({ step: stepName, isFromGoalPage }: GoalQuestionScreenProps) {
  const router = useRouter();
  const { draft, hasChanges, answer, hasStoredGoal } = useGoalDraft();
  const [isAsking, setIsAsking] = useState(false);
  const step = GOAL_QUESTION_STEPS.indexOf(stepName) + 1;
  const question = GOAL_QUESTIONS[stepName];

  function leave() {
    router.replace(goalLeavePath(hasStoredGoal));
  }

  function renderAnswers() {
    switch (stepName) {
      case "goal":
        return (
          <GoalStep
            value={draft.goal}
            onChange={(goal) => {
              answer({ goal });
            }}
          />
        );
      case "focus":
        return (
          <FocusStep
            value={draft.focus}
            onChange={(focus) => {
              answer({ focus });
            }}
          />
        );
      case "days":
        return (
          <DaysStep
            value={draft.days_per_week}
            onChange={(days) => {
              answer({ days_per_week: days });
            }}
          />
        );
      case "minutes":
        return (
          <MinutesStep
            value={draft.session_minutes}
            onChange={(minutes) => {
              answer({ session_minutes: minutes });
            }}
          />
        );
      case "equipment":
        return (
          <EquipmentStep
            value={draft.equipment ?? []}
            onChange={(equipment) => {
              answer({ equipment });
            }}
          />
        );
      case "experience":
        return (
          <ExperienceStep
            value={draft.experience}
            onChange={(experience) => {
              answer({ experience });
            }}
          />
        );
    }
  }

  return (
    <>
      <QuestionStepper
        step={step}
        title={question.title}
        help={question.help}
        note={question.note}
        isNextEnabled={isGoalStepAnswered(draft, step)}
        onBack={
          step === 1
            ? undefined
            : () => {
                if (isFromGoalPage) {
                  router.back();
                } else {
                  router.push(goalQuestionPath(step - 1));
                }
              }
        }
        onCancel={() => {
          if (hasChanges) {
            setIsAsking(true);
          } else {
            leave();
          }
        }}
        onNext={() => {
          router.push(
            step === GOAL_QUESTION_STEPS.length
              ? goalSummaryPath()
              : goalQuestionPath(step + 1, { fromGoalPage: isFromGoalPage }),
          );
        }}
      >
        {renderAnswers()}
      </QuestionStepper>
      <CloseGoalDialog
        open={isAsking}
        onKeepAnswering={() => {
          setIsAsking(false);
        }}
        onClose={() => {
          setIsAsking(false);
          leave();
        }}
      />
    </>
  );
}
