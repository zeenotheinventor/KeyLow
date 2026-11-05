"use client";

import { useStartSessionAction, useTrainingGoals } from "@keylow/api-client";
import { TRAIN_START_FAILED } from "@keylow/core/copy";
import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { useSuggestionNotices } from "../SuggestionCard";
import { TrainScreen } from "../TrainScreen";

import { useToast } from "@/components/ui/Toast";
import { goalFromTrainPath, goalQuestionPath } from "@/lib/goalRoutes";
import { trainRoutineNewPath, trainSessionDetailPath, trainSessionPath } from "@/lib/trainRoutes";

/**
 * The Train page with its buttons wired: Start and Log a session start a session at the moment of the press
 * and open its page, and Resume opens it. One session is open at a time, so a start with one in progress
 * opens that one. Create routine opens the new routine's editor. A start that fails shows a danger toast
 * that states the rule, opens nothing and can be pressed again. View session on the Done card opens the
 * session's detail. Set your goal, on the suggestion card and the first visit's card, opens the Goal page,
 * told it came from Train, when a goal was read to exist, and the first question when there is none or it is not
 * known yet (offline, loading or failed), so the button always leads somewhere. The suggestion card's toasts are
 * the page's.
 */
export function TrainRoute() {
  const router = useRouter();
  const toast = useToast();
  const openSession = () => {
    router.push(trainSessionPath());
  };
  const { start, isStarting } = useStartSessionAction({
    onStarted: openSession,
    onFailure: () => {
      toast.show({ message: TRAIN_START_FAILED, tone: "danger", icon: CircleAlert });
    },
  });

  const goals = useTrainingGoals();
  const hasGoal = goals.data !== undefined && goals.data !== null;
  const suggestionToasts = useSuggestionNotices(start);

  return (
    <TrainScreen
      isStarting={isStarting}
      onCreateRoutine={() => {
        router.push(trainRoutineNewPath());
      }}
      onStart={start}
      onLogSession={start}
      onResume={openSession}
      onSetGoal={() => {
        router.push(hasGoal ? goalFromTrainPath() : goalQuestionPath(1));
      }}
      onViewSession={(sessionId) => {
        router.push(trainSessionDetailPath(sessionId, "train"));
      }}
      suggestionNotices={suggestionToasts.notices}
      onSuggestionAddPress={suggestionToasts.noteAddPress}
    />
  );
}
