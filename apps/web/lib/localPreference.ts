/**
 * A choice kept on this device in `localStorage`, such as the view the body map was last left in. Storage that
 * is blocked, full or missing reads as nothing saved and a write that fails is dropped, so a screen never
 * has to wrap these in a try. Call them from an effect or an event handler, not while rendering, because the
 * server has no storage and a first draw that read it would not match the page it sent.
 */

/** What `readLocalPreferenceState` found: a value the guard accepts, nothing usable, or storage that cannot be read. */
export type LocalPreferenceState<Value extends string> =
  { status: "saved"; value: Value } | { status: "empty" } | { status: "unreadable" };

/**
 * What is saved under `key`, telling nothing usable (none saved, or a value the guard refuses) from
 * storage that cannot be read, for a choice that must not be asked again when it could never be saved.
 */
export function readLocalPreferenceState<Value extends string>(
  key: string,
  isValue: (stored: string) => stored is Value,
): LocalPreferenceState<Value> {
  try {
    const stored = window.localStorage.getItem(key);
    return stored !== null && isValue(stored)
      ? { status: "saved", value: stored }
      : { status: "empty" };
  } catch {
    return { status: "unreadable" };
  }
}

/** The value saved under `key`, or null when none is saved, the guard refuses it or storage cannot be read. */
export function readLocalPreference<Value extends string>(
  key: string,
  isValue: (stored: string) => stored is Value,
): Value | null {
  const state = readLocalPreferenceState(key, isValue);
  return state.status === "saved" ? state.value : null;
}

/** Saves `value` under `key`. A value that cannot be saved still applies for the visit, so the failure is not raised. */
export function writeLocalPreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the next visit starts from the last value that did save.
  }
}
