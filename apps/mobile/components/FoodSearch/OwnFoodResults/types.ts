export type OwnFoodResultsProps = {
  /** What the user has typed, untrimmed. It narrows the list and nothing else. */
  query: string;
  onOpenFood: (foodId: string) => void;
  onCreateFood: () => void;
};
