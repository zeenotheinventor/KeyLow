import { currentFormMediaPreferenceStore } from "./currentFormMediaPreferenceStore";
import { createFormMediaPreferenceStore } from "./formMediaPreferenceStore";

/** Forgets what was read and chosen, so each test starts from a fresh install. For tests only. */
export function resetFormMediaPreferenceForTests(): void {
  currentFormMediaPreferenceStore.store = createFormMediaPreferenceStore();
}
