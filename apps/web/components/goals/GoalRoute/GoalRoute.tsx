"use client";

import { useTrainingGoals } from "@keylow/api-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { GoalScreen } from "../GoalScreen";

import type { GoalRouteProps } from "./types";

import { goalQuestionPath, isOpenedFromTrain } from "@/lib/goalRoutes";

/**
 * The flow's own address: the Goal page when a goal is stored, and the first question when none is. The flow
 * above has waited for a running read, so the goal is known by now, or cannot be: a read paused because the
 * browser is offline and one that failed are not waited for, and they open the questions, empty, as the flow's
 * answers do. Nothing is drawn while the person is sent on, so no wrong page shows first. The first question
 * keeps Train as the origin when the address says Train opened the flow.
 */
export function GoalRoute({ from }: GoalRouteProps) {
  const router = useRouter();
  const goal = useTrainingGoals().data;
  const hasNoGoal = goal === undefined || goal === null;
  const isFromTrain = isOpenedFromTrain(from);

  useEffect(() => {
    if (hasNoGoal) {
      router.replace(goalQuestionPath(1, { fromTrain: isFromTrain }));
    }
  }, [hasNoGoal, isFromTrain, router]);

  return hasNoGoal ? null : <GoalScreen goal={goal} isFromTrain={isFromTrain} />;
}
