import { currentRecipePrefillStore } from "./currentRecipePrefillStore";
import { createRecipePrefillStore } from "./recipePrefillStore";

let idCount = 0;

/** Forgets every pending draft, every saved one and every listener, so each test starts from a fresh app. Ids count up so a test can name them. For tests only. */
export function resetRecipePrefillForTests(): void {
  idCount = 0;
  currentRecipePrefillStore.store = createRecipePrefillStore(() => {
    idCount += 1;
    return `prefill-${idCount}`;
  });
}
