"use client";

import { GOAL_QUESTION_STEPS } from "@keylow/core/copy";
import { firstUnansweredStep } from "@keylow/core/training";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useGoalDraft } from "../GoalDraftProvider";
import { GoalQuestionScreen } from "../GoalQuestionScreen";

import type { GoalQuestionRouteProps } from "./types";

import { goalQuestionPath, isOpenedFromGoalPage, readGoalStep } from "@/lib/goalRoutes";

/**
 * A question's address ends in its number. Anything that is not one of the six opens the first question, and
 * so does a question reached while an earlier one is still open: the person is sent to that earlier one, as
 * on a reload, which drops the answers. Every question on screen therefore has the question before it, for
 * Back to return to. Nothing is drawn while the person is being sent on.
 */
export function GoalQuestionRoute({ step, from }: GoalQuestionRouteProps) {
  const router = useRouter();
  const { draft } = useGoalDraft();
  const question = readGoalStep(step);
  const firstOpen =
    question === undefined
      ? 1
      : firstUnansweredStep(draft, GOAL_QUESTION_STEPS.indexOf(question) + 1);

  useEffect(() => {
    if (firstOpen !== undefined) {
      router.replace(goalQuestionPath(firstOpen));
    }
  }, [firstOpen, router]);

  return question === undefined || firstOpen !== undefined ? null : (
    <GoalQuestionScreen step={question} isFromGoalPage={isOpenedFromGoalPage(from)} />
  );
}
