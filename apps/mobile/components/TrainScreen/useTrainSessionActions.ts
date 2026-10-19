import { useStartSession } from "@keylow/api-client";
import { TRAIN_START_FAILED } from "@keylow/core/copy";
import { useRouter } from "expo-router";
import { useRef } from "react";

import { useToast } from "../ui";

import type { TrainSessionStart } from "./types";

// A second press of Start or Resume within this long is the same press: pushing the screen twice would stack it.
const OPEN_COOLDOWN_MILLISECONDS = 1000;

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
 * press and open the screen it lives on, and Resume opens the screen. A start that fails shows a danger
 * toast that states the rule, opens nothing and can be pressed again. `useStartSession` resolves to the
 * session in progress when there is one, so a start never makes a second, and the guard here keeps a double
 * press from opening the screen twice. The screen is opened once for a press of Start or Resume, however fast
 * the second comes.
 */
export function useTrainSessionActions(): TrainSessionActions {
  const router = useRouter();
  const toast = useToast();
  const startSession = useStartSession();
  const isStarting = useRef(false);
  const lastOpenedAt = useRef<number | null>(null);

  function openSession() {
    const now = Date.now();
    if (lastOpenedAt.current !== null && now - lastOpenedAt.current < OPEN_COOLDOWN_MILLISECONDS) {
      return;
    }
    lastOpenedAt.current = now;
    router.push("/session");
  }

  return {
    isStarting: startSession.isPending,
    start: ({ routineDayId, timeZone }) => {
      if (isStarting.current) {
        return;
      }
      isStarting.current = true;
      startSession.mutate(
        { routineDayId, now: new Date(), tz: timeZone },
        {
          onSuccess: openSession,
          onError: () => {
            toast.show({ message: TRAIN_START_FAILED, tone: "danger", icon: "CircleAlert" });
          },
          onSettled: () => {
            isStarting.current = false;
          },
        },
      );
    },
    resume: openSession,
  };
}
