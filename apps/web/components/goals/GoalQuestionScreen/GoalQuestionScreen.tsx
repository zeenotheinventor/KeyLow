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

import { goalExitPath, goalQuestionPath, goalSummaryPath } from "@/lib/goalRoutes";

/**
 * One question of the goal questionnaire. The answers are kept by the flow's layout, so Back loses none.
 * Cancel asks first when the answers differ from those the flow opened with, so there is something to lose.
 * Next on the sixth question opens the summary, which saves.
 */
export function GoalQuestionScreen({ step: stepName }: GoalQuestionScreenProps) {
  const router = useRouter();
  const { draft, hasChanges, answer } = useGoalDraft();
  const [isAsking, setIsAsking] = useState(false);
  const step = GOAL_QUESTION_STEPS.indexOf(stepName) + 1;
  const question = GOAL_QUESTIONS[stepName];

  function leave() {
    router.replace(goalExitPath());
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
                router.push(goalQuestionPath(step - 1));
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
            step === GOAL_QUESTION_STEPS.length ? goalSummaryPath() : goalQuestionPath(step + 1),
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
