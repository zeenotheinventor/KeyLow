import { useRef } from "react";

import { useStartSession } from "./useStartSession";

/** What a start describes: the routine day to follow (null for a free session) and the profile's zone. */
export type SessionStartRequest = {
  routineDayId: string | null;
  timeZone: string;
};

type StartSessionNotices = {
  /** The session is started, or the one already in progress is the result. The app opens its screen. */
  onStarted: () => void;
  /** The start failed. The app says so and leaves the button to be pressed again. */
  onFailure: () => void;
};

/**
 * What the Train page's buttons do to start a session: Start and Log a session start one at the moment of
 * the press. `useStartSession` resolves to the session in progress when there is one, so a start never makes
 * a second, and the guard here keeps a double press from starting twice.
 */
export function useStartSessionAction({ onStarted, onFailure }: StartSessionNotices) {
  const startSession = useStartSession();
  const isStarting = useRef(false);

  return {
    isStarting: startSession.isPending,
    start: ({ routineDayId, timeZone }: SessionStartRequest) => {
      if (isStarting.current) {
        return;
      }
      isStarting.current = true;
      startSession.mutate(
        { routineDayId, now: new Date(), tz: timeZone },
        {
          onSuccess: onStarted,
          onError: onFailure,
          onSettled: () => {
            isStarting.current = false;
          },
        },
      );
    },
  };
}
