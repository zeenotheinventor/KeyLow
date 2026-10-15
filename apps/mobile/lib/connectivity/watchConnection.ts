import { PROBE_INTERVAL_MS } from "./constants";

import type { AppStateStatus } from "react-native";

type WatchConnectionOptions = {
  /** Resolves to whether the server can be reached. */
  probe: () => Promise<boolean>;
  /** Told the answer of every probe. */
  onChange: (isOnline: boolean) => void;
  appState: {
    currentState: AppStateStatus;
    addEventListener: (
      type: "change",
      listener: (state: AppStateStatus) => void,
    ) => { remove: () => void };
  };
};

/**
 * Keeps checking that the server can be reached, in plain JavaScript, so it needs no native module: it
 * probes at once, whenever the app comes back to the foreground, and every `PROBE_INTERVAL_MS` while it is
 * there. Nothing runs in the background. Returns what stops it, after which no answer is passed on.
 */
export function watchConnection({ probe, onChange, appState }: WatchConnectionOptions): () => void {
  let isStopped = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const check = () => {
    void probe().then((isOnline) => {
      if (!isStopped) {
        onChange(isOnline);
      }
    });
  };
  const stopTimer = () => {
    clearInterval(timer);
    timer = undefined;
  };
  const startChecking = () => {
    stopTimer();
    check();
    timer = setInterval(check, PROBE_INTERVAL_MS);
  };

  if (appState.currentState === "active") {
    startChecking();
  }
  const subscription = appState.addEventListener("change", (state) => {
    if (state === "active") {
      startChecking();
    } else {
      stopTimer();
    }
  });

  return () => {
    isStopped = true;
    stopTimer();
    subscription.remove();
  };
}
