"use client";

import { useTrainingGoals } from "@keylow/api-client";
import { goalAnswersOfRow } from "@keylow/core/training";

import { GoalDraftProvider } from "../GoalDraftProvider";

import type { GoalFlowProps } from "./types";

/**
 * Holds the answers for every question of the goal questionnaire, and opens the flow filled with the goal
 * that is stored. The provider reads the goal once, when it mounts, so it is mounted when the goal read has
 * finished, or the questions would show empty and fill a moment later. The blank waits only while a request
 * is running, which a failing one retries a few times first. A read that is paused because the browser is
 * offline does not wait: the flow still opens, with nothing filled, since a goal arriving later does not
 * fill a draft that is read once. A goal that cannot be read opens the questions empty too, and saving then
 * replaces the goal. The terms gate is in the dashboard layout, so the read is always on.
 */
export function GoalFlow({ children }: GoalFlowProps) {
  const goals = useTrainingGoals();
  const isWaiting = goals.isPending && goals.fetchStatus === "fetching";

  if (isWaiting) {
    return <div aria-busy="true" />;
  }

  return (
    <GoalDraftProvider
      initialAnswers={
        goals.data === null || goals.data === undefined ? undefined : goalAnswersOfRow(goals.data)
      }
    >
      {children}
    </GoalDraftProvider>
  );
}
