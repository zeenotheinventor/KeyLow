import { currentRecipePrefillStore } from "./currentRecipePrefillStore";

import type { RecipePrefill } from "./recipePrefillStore";

export type { RecipePrefill } from "./recipePrefillStore";

/** Leaves a drafted recipe for the editor and returns the unguessable id its address carries. */
export const beginRecipePrefill = (prefill: RecipePrefill): string =>
  currentRecipePrefillStore.store.begin(prefill);

/** The draft left under the id, until it is consumed. Nothing for an id that was not given out. */
export const peekRecipePrefill = (id: string): RecipePrefill | undefined =>
  currentRecipePrefillStore.store.peek(id);

/** Takes the draft out once the editor has it, so the id opens nothing again. */
export const consumeRecipePrefill = (id: string): void => {
  currentRecipePrefillStore.store.consume(id);
};

/** The editor's word that it saved the draft the card knows by this key as this recipe. */
export const markRecipePrefillSaved = (draftKey: string, recipeId: string): void => {
  currentRecipePrefillStore.store.markSaved(draftKey, recipeId);
};

/** The recipe a draft was saved as in this run of the app, if it was. */
export const savedRecipeIdOfDraft = (draftKey: string): string | undefined =>
  currentRecipePrefillStore.store.savedRecipeIdOf(draftKey);

/** Forgets every pending draft and every saved one, as when the account signs out. */
export const clearRecipePrefill = (): void => {
  currentRecipePrefillStore.store.clear();
};

/** Tells the listener whenever a draft is saved or the store is cleared. Returns what stops it. */
export const subscribeRecipePrefill = (listener: () => void): (() => void) =>
  currentRecipePrefillStore.store.subscribe(listener);
