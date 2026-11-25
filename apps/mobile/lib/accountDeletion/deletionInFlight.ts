let callsInFlight = 0;

/**
 * Whether this app is waiting on the server for a deletion. The start-up runner leaves everything alone
 * then: auth-js can send SIGNED_OUT while the call is still open, for an account that still exists (it
 * removes a session the server has already signed out), and only the call's own answer is proof.
 */
export function isDeletionInFlight(): boolean {
  return callsInFlight > 0;
}

/** Runs `call` and counts it as in flight until it settles. */
export async function trackDeletionInFlight<T>(call: () => Promise<T>): Promise<T> {
  callsInFlight += 1;
  try {
    return await call();
  } finally {
    callsInFlight -= 1;
  }
}
