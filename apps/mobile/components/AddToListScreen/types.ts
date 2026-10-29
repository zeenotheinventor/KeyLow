export type AddToListScreenProps = {
  /** The recipe's id, from the address. */
  id: string;
  /**
   * The servings to start at, as the address carries them. Text that is not a servings number for this
   * recipe starts at the recipe's own.
   */
  servingsText: string | undefined;
};
