import { useStartSessionAction } from "@keylow/api-client";
import { TRAIN_START_FAILED } from "@keylow/core/copy";

import { useOpenSession } from "../../lib/useOpenSession";
import { useToast } from "../ui";

import type { TrainSessionStart } from "./types";

type TrainSessionActions = {
  /** Starts the session a start describes, then opens the session screen. A press while a start is under way does nothing. */
  start: (start: TrainSessionStart) => void;
  /** Opens the session screen for the session in progress. Nothing is started. */
  resume: () => void;
  /** Whether a start is under way, which the buttons that start one show. */
  isStarting: boolean;
};

/**
 * What the Train tab's buttons do with a session: Start and Log a session start one at the moment of the
 * press and open the screen it lives on, and Resume opens the screen. The rules of a start are
 * `@keylow/api-client`'s, shared with the web. A start that fails shows a danger toast that states the
 * rule, opens nothing and can be pressed again. The screen is opened once for a press of Start or Resume,
 * however fast the second comes.
 */
export function useTrainSessionActions(): TrainSessionActions {
  const openSession = useOpenSession();
  const toast = useToast();
  const { start, isStarting } = useStartSessionAction({
    onStarted: openSession,
    onFailure: () => {
      toast.show({ message: TRAIN_START_FAILED, tone: "danger", icon: "CircleAlert" });
    },
  });

  return { isStarting, start, resume: openSession };
}
