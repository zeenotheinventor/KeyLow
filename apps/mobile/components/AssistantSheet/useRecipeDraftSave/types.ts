export type RecipeDraftSave = {
  /**
   * `saving` while the editor's foods load, `failed` when they could not be loaded, and `cannot_rebuild` when a
   * line of the draft cannot be made again.
   */
  status: "idle" | "saving" | "failed" | "cannot_rebuild";
  /** The recipe the editor saved the draft as, or undefined while it was not saved. */
  savedRecipeId: string | undefined;
  /** Loads the foods and opens the editor. A press while one is under way does nothing. */
  save: () => Promise<void>;
};
