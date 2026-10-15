import * as Updates from "expo-updates";

// What the check came to. "reloading" is the only one where the app is about to restart.
export type UpdateOutcome = "skipped" | "reloading" | "up-to-date" | "timed-out" | "failed";

// How long the splash screen waits for the check and the download together. A slow network misses it,
// and the app carries on with the bundle it has. The download goes on, so the next start has it.
export const updateCheckTimeoutMilliseconds = 5000;

async function downloadAndReload(isAbandoned: () => boolean): Promise<UpdateOutcome> {
  const check = await Updates.checkForUpdateAsync();

  // The running update is never fetched again, so a reload cannot lead to another reload. Ids are compared
  // without regard to letter case, as a UUID may be written either way.
  if (!check.isAvailable || check.manifest.id.toLowerCase() === Updates.updateId?.toLowerCase()) {
    return "up-to-date";
  }

  const fetched = await Updates.fetchUpdateAsync();

  // After the time is up the app is already on screen, and a restart now would pull it away from the user.
  if (!fetched.isNew || isAbandoned()) {
    return "up-to-date";
  }

  await Updates.reloadAsync();

  return "reloading";
}

/**
 * Brings the app onto the newest published update before it is shown, so a fresh install does not open on
 * the code built into it. It never throws: on a timeout or an error the app carries on with its bundle.
 * It does nothing in development, where no update exists, and after an emergency launch, where reloading
 * would fetch the update that just failed to launch and go round again.
 */
export async function startOnLatestUpdate(): Promise<UpdateOutcome> {
  if (__DEV__ || !Updates.isEnabled || Updates.isEmergencyLaunch) {
    return "skipped";
  }

  let isAbandoned = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<UpdateOutcome>((resolve) => {
    timer = setTimeout(() => {
      isAbandoned = true;
      resolve("timed-out");
    }, updateCheckTimeoutMilliseconds);
  });

  try {
    return await Promise.race([downloadAndReload(() => isAbandoned), timedOut]);
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}
