export type SyncScheduler = Readonly<{
  /** Asks for a run after the quiet period, and asks again each time it is called, so a burst is one run. */
  schedule: () => void;
  /** Runs now, with no wait. */
  runNow: () => void;
  /** Cancels what is waiting. A run already going finishes. */
  stop: () => void;
}>;

/**
 * Runs `run` for the triggers, never two at a time. A trigger that comes while one run is going is
 * remembered and answered with one more run after it, so a write made during a run is not missed. A run
 * that throws is dropped: the next trigger makes it again, and nothing about it is kept.
 */
export function createSyncScheduler(
  run: () => Promise<void>,
  debounceMilliseconds: number,
): SyncScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let isRunning = false;
  let isRunWaiting = false;
  let isStopped = false;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const takeWaitingRun = () => {
    const wasWaiting = isRunWaiting;
    isRunWaiting = false;
    return wasWaiting;
  };

  const start = async () => {
    if (isRunning) {
      isRunWaiting = true;
      return;
    }
    isRunning = true;
    try {
      do {
        try {
          await run();
        } catch {
          // The next trigger makes the run again.
        }
      } while (takeWaitingRun() && !isStopped);
    } finally {
      isRunning = false;
    }
  };

  return {
    schedule: () => {
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        void start();
      }, debounceMilliseconds);
    },
    runNow: () => {
      clearTimer();
      void start();
    },
    stop: () => {
      isStopped = true;
      clearTimer();
    },
  };
}
