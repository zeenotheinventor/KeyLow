"use client";

import { firstUnansweredStep, goalAnswersSchema } from "@keylow/core/training";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

import { useGoalDraft } from "../GoalDraftProvider";
import { GoalSummaryScreen } from "../GoalSummaryScreen";

import type { GoalSummaryRouteProps } from "./types";

import { goalQuestionPath, isOpenedFromTrain } from "@/lib/goalRoutes";

// The number past the last question, so every question counts as before it.
const PAST_THE_LAST_QUESTION = 7;

/**
 * The summary's own address, which the last question leads to. It reads the answers the flow holds, and with
 * any question still open it sends the person to that question, as a question reached too early is sent, so
 * a goal that is not complete is never shown and never saved. Nothing is drawn while the person is sent on.
 */
export function GoalSummaryRoute({ origin }: GoalSummaryRouteProps) {
  const router = useRouter();
  const { draft } = useGoalDraft();
  const isFromTrain = isOpenedFromTrain(origin);
  const parsed = useMemo(() => goalAnswersSchema.safeParse(draft), [draft]);
  const firstOpen = firstUnansweredStep(draft, PAST_THE_LAST_QUESTION) ?? 1;

  useEffect(() => {
    if (!parsed.success) {
      router.replace(goalQuestionPath(firstOpen, { fromTrain: isFromTrain }));
    }
  }, [parsed.success, firstOpen, isFromTrain, router]);

  return parsed.success ? (
    <GoalSummaryScreen answers={parsed.data} isFromTrain={isFromTrain} />
  ) : null;
}
