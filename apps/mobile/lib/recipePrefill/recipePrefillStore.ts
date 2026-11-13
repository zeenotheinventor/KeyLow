import type { RecipeDraft } from "@keylow/core/recipes";

/** What the editor opens with: the draft, and the word to open its add-ingredient search on when a line matched no food. */
export type RecipePrefill = {
  draft: RecipeDraft;
  /** The key the card knows the draft by, so it can show the draft as saved. */
  draftKey: string;
  /** The first line that matched no food, or null. It is never put in an address. */
  searchWord: string | null;
};

/**
 * The hand-over from the assistant's suggested recipe card to the recipe editor. A route cannot carry a
 * recipe, and the address must not hold one (it is logged as a breadcrumb), so the card leaves the draft here
 * under an unguessable id (`createId`) and the address carries the id. The editor takes the draft out when it
 * reads it, so an id opens one editor once. When the editor saves, it says which recipe it made, and the card,
 * which knows the draft by its key, shows the saved state. Nothing is stored on the device: it all lives as
 * long as the app does, and `clear` empties it when the account signs out, so the next account sees nothing of
 * the last one's drafts or saves.
 */
export function createRecipePrefillStore(createId: () => string) {
  const pending = new Map<string, RecipePrefill>();
  const savedByDraftKey = new Map<string, string>();
  const listeners = new Set<() => void>();

  const tellListeners = () => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  return {
    begin: (prefill: RecipePrefill): string => {
      // A second press on the same card replaces its first, so a card leaves at most one draft pending.
      for (const [id, found] of pending) {
        if (found.draftKey === prefill.draftKey) {
          pending.delete(id);
        }
      }
      const id = createId();
      pending.set(id, prefill);
      return id;
    },
    /** Reads the draft without taking it, so reading twice (a render that runs again) gives the same answer. */
    peek: (id: string): RecipePrefill | undefined => pending.get(id),
    /** Takes the draft out, so the id opens nothing afterwards. */
    consume: (id: string) => {
      pending.delete(id);
    },
    markSaved: (draftKey: string, recipeId: string) => {
      savedByDraftKey.set(draftKey, recipeId);
      tellListeners();
    },
    savedRecipeIdOf: (draftKey: string): string | undefined => savedByDraftKey.get(draftKey),
    clear: () => {
      pending.clear();
      savedByDraftKey.clear();
      tellListeners();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
