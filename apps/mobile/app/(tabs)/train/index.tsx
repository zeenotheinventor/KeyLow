import { useTrainingGoals } from "@keylow/api-client";
import { useRouter } from "expo-router";
import { useMemo } from "react";

import { TrainScreen, useTrainSessionActions } from "../../../components/TrainScreen";
import { useToast } from "../../../components/ui";
import { bodyMapPath } from "../../../lib/bodyMapRoutes";
import { goalPath, goalQuestionPath } from "../../../lib/goalRoutes";
import { sessionDetailPath } from "../../../lib/historyRoutes";
import { newRoutinePath, routinesPath } from "../../../lib/routineRoutes";
import { useOpenOnce } from "../../../lib/useOpenOnce";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

import type { SuggestionNotices } from "@keylow/api-client";

export default function TrainRoute() {
  const router = useRouter();
  const { start, resume, isStarting } = useTrainSessionActions();
  // A second tap while the routines are sliding in would stack them twice.
  const openOnce = useOpenOnce();
  const trainingGoals = useTrainingGoals({ enabled: useReadsEnabled() });
  // Only a goal that was read to exist opens the Goal screen. With none, or while it is not known, the
  // questionnaire opens at its first question, which fills in whatever answers there are.
  const hasGoal = trainingGoals.data !== undefined && trainingGoals.data !== null;

  const toast = useToast();
  // The suggestion card's toast: the add with Undo, and the failure of an add or an Undo. Its Start is ours.
  const suggestionNotices = useMemo<SuggestionNotices>(
    () => ({
      onAccepted: ({ message, actionLabel, undo }) => {
        toast.show({ message, actionLabel, onAction: undo });
      },
      onFailure: (message: string) => {
        toast.show({ message, icon: "CircleAlert", tone: "danger" });
      },
      // A suggestion for today is stored first, then started the way every Start is, which opens the session.
      onStart: start,
    }),
    [toast, start],
  );

  return (
    <TrainScreen
      isStarting={isStarting}
      onCreateRoutine={() => {
        // The routines list goes under the editor, so a saved routine returns to it and Cancel does too.
        openOnce(() => {
          router.push(routinesPath());
          router.push(newRoutinePath());
        });
      }}
      onLogSession={start}
      onOpenBodyMap={() => {
        openOnce(() => {
          router.push(bodyMapPath("train"));
        });
      }}
      onOpenHistory={() => {
        router.push("/train/history");
      }}
      onOpenRoutines={() => {
        openOnce(() => {
          router.push(routinesPath());
        });
      }}
      onResume={resume}
      onSetGoal={() => {
        openOnce(() => {
          router.push(hasGoal ? goalPath() : goalQuestionPath(1));
        });
      }}
      onStart={start}
      onViewSession={(sessionId) => {
        router.push(sessionDetailPath(sessionId, "train"));
      }}
      suggestionNotices={suggestionNotices}
    />
  );
}
