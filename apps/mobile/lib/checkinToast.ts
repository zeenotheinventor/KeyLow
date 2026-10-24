// A check-in that changed the calorie target leaves one fact for the diary: a new target exists. The
// signal carries no figure, because a target is health data and the diary reads its own from the
// targets read. It is held in memory only, so a relaunch forgets it.

let isWaiting = false;
const listeners = new Set<() => void>();

function tellListeners() {
  listeners.forEach((listener) => {
    listener();
  });
}

/** Says a check-in has set a new calorie target, for the diary to show once. */
export function announceNewTargets(): void {
  if (isWaiting) {
    return;
  }
  isWaiting = true;
  tellListeners();
}

/** Whether a new target is waiting to be shown. A component reads this, and `takeNewTargets` uses it up. */
export function hasNewTargets(): boolean {
  return isWaiting;
}

/** Uses the signal up: true the first time after it is announced, false after that. */
export function takeNewTargets(): boolean {
  if (!isWaiting) {
    return false;
  }
  isWaiting = false;
  tellListeners();
  return true;
}

/** Calls `listener` whenever the signal is announced or taken. Returns the way to stop. */
export function subscribeToNewTargets(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
