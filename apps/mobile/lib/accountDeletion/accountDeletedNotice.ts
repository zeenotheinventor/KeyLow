// A finished account deletion leaves one fact for the sign-in screen: the account is gone. The signal carries
// no data (not even an id), and is held in memory only, so a relaunch forgets it. Unlike the new-target
// signal, nothing on SIGNED_OUT clears it, because the sign-in screen reads it after the sign out.

let isWaiting = false;
const listeners = new Set<() => void>();

function tellListeners() {
  listeners.forEach((listener) => {
    listener();
  });
}

/** Says the account was deleted, for the sign-in screen to show once. */
export function announceAccountDeleted(): void {
  if (isWaiting) {
    return;
  }
  isWaiting = true;
  tellListeners();
}

/** Whether the notice is waiting to be shown. A component reads this, and `takeAccountDeletedNotice` uses it up. */
export function hasAccountDeletedNotice(): boolean {
  return isWaiting;
}

/** Uses the notice up: true the first time after it is announced, false after that. */
export function takeAccountDeletedNotice(): boolean {
  if (!isWaiting) {
    return false;
  }
  isWaiting = false;
  tellListeners();
  return true;
}

/** Calls `listener` whenever the notice is announced or taken. Returns the way to stop. */
export function subscribeToAccountDeletedNotice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
