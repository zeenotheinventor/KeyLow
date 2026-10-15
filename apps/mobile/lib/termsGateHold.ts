import { useSyncExternalStore } from "react";

/**
 * How long a hold can last. A sign-up whose recording stalls would otherwise leave the person on the
 * loading mark for good. Letting go then shows the accept screen, which is safe: it asks for what the
 * stalled call was recording.
 */
export const TERMS_GATE_HOLD_LIMIT_MS = 15_000;

let holdCount = 0;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/**
 * Keeps the accept-to-continue gate on its loading state until the returned function is called. A Google
 * sign-up holds it from before the sign-in to after the acceptance is recorded, because the session the
 * sign-in starts reaches the gate before the acceptance exists, and the gate would show the accept screen
 * to a person who has just ticked the box. The returned function can be called more than once. A hold
 * lets go by itself after `TERMS_GATE_HOLD_LIMIT_MS`.
 */
export function holdTermsGate(): () => void {
  let isReleased = false;
  holdCount += 1;
  notifyListeners();

  const release = () => {
    if (isReleased) {
      return;
    }

    isReleased = true;
    clearTimeout(limitTimer);
    holdCount -= 1;
    notifyListeners();
  };
  const limitTimer = setTimeout(release, TERMS_GATE_HOLD_LIMIT_MS);

  return release;
}

export function useIsTermsGateHeld(): boolean {
  return useSyncExternalStore(subscribe, () => holdCount > 0);
}
