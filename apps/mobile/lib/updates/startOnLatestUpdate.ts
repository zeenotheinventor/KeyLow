import * as Updates from "expo-updates";

// What the check came to. "reloading" is the only one where the app is about to restart. "stalled" is a
// download that stopped moving, and "timed-out" a check that never came back.
export type UpdateOutcome =
  "skipped" | "reloading" | "up-to-date" | "timed-out" | "stalled" | "failed";

/**
 * What the caller hears while an update comes down. `onUpdateFound` is called once, before the download
 * starts, so the caller can put up a screen for the wait. `onProgress` follows the download from 0 to 1,
 * and gets a 1 when it is done, just before the restart.
 */
export type UpdateCallbacks = {
  onUpdateFound?: () => void;
  onProgress?: (progress: number) => void;
};

// How long the check for an update may take. It covers the check only. A slow network misses it, and the
// app carries on with the bundle it has. A download is not on this clock, it has the stall time below.
export const updateCheckTimeoutMilliseconds = 5000;

// How long a download may go without its progress changing. The clock starts with the download and starts
// again at every change, so a slow download that keeps moving is never cut off. Where the build reports no
// progress at all, this is the limit on the download as a whole. The download goes on after the app carries
// on, so the next start has it.
export const updateStallTimeoutMilliseconds = 15_000;

/**
 * Brings the app onto the newest published update before it is shown, so a fresh install does not open on
 * the code built into it. It never throws: on a timeout, a stall or an error the app carries on with its
 * bundle. It does nothing in development, where no update exists, and after an emergency launch, where
 * reloading would fetch the update that just failed to launch and go round again.
 */
export async function startOnLatestUpdate(callbacks: UpdateCallbacks = {}): Promise<UpdateOutcome> {
  if (__DEV__ || !Updates.isEnabled || Updates.isEmergencyLaunch) {
    return "skipped";
  }

  // Once the outcome is known the app is on screen, and nothing that arrives later may show a screen or
  // restart the app under the user.
  let hasSettled = false;
  // Read through a function, because a timer can settle the outcome during any wait, and the compiler would
  // otherwise take the flag to be false for good.
  const isSettled = () => hasSettled;
  let settle: (outcome: UpdateOutcome) => void = () => {};
  const outcome = new Promise<UpdateOutcome>((resolve) => {
    settle = (value) => {
      hasSettled = true;
      resolve(value);
    };
  });

  const checkTimer = setTimeout(() => {
    settle("timed-out");
  }, updateCheckTimeoutMilliseconds);
  let stallTimer: ReturnType<typeof setTimeout> | undefined;
  let subscription: { remove: () => void } | undefined;

  function restartStallTimer() {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      settle("stalled");
    }, updateStallTimeoutMilliseconds);
  }

  async function checkAndDownload() {
    const check = await Updates.checkForUpdateAsync();

    // The running update is never fetched again, so a reload cannot lead to another reload. Ids are compared
    // without regard to letter case, as a UUID may be written either way.
    if (!check.isAvailable || check.manifest.id.toLowerCase() === Updates.updateId?.toLowerCase()) {
      settle("up-to-date");
      return;
    }

    clearTimeout(checkTimer);

    // The check came back after its time was up. The app is already on screen, so only the download is
    // carried on, for the next start.
    if (isSettled()) {
      await Updates.fetchUpdateAsync();
      return;
    }

    callbacks.onUpdateFound?.();

    let latestProgress: number | undefined;
    try {
      subscription = Updates.addUpdatesStateChangeListener(({ context }) => {
        if (isSettled() || !context.isDownloading || context.downloadProgress === latestProgress) {
          return;
        }

        latestProgress = context.downloadProgress;
        restartStallTimer();
        callbacks.onProgress?.(context.downloadProgress);
      });
    } catch {
      // The listener is not part of the documented API, so if it is missing or throws, the download goes on
      // without progress and the bar stays indeterminate. The stall time then bounds the fetch as a whole.
    }
    restartStallTimer();

    const fetched = await Updates.fetchUpdateAsync();

    if (!fetched.isNew || isSettled()) {
      settle("up-to-date");
      return;
    }

    // The fetch may have returned long after the last change in progress, and the stall timer is still
    // running from it. The reload gets a full stall time of its own, so a slow start of the restart does not
    // read as a stall, and a reload that never returns still ends in one.
    restartStallTimer();
    callbacks.onProgress?.(1);
    await Updates.reloadAsync();
    settle("reloading");
  }

  checkAndDownload().catch(() => {
    settle("failed");
  });

  try {
    return await outcome;
  } finally {
    clearTimeout(checkTimer);
    clearTimeout(stallTimer);
    subscription?.remove();
  }
}
