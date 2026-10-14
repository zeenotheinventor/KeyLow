export type ErrorStateRetry = {
  /** The button's label: short, sentence case, no full stop, such as "Try again". */
  label: string;
  onPress: () => void;
};

export type ErrorStateProps = {
  /** The fixed sentence that says what failed. A screen passes it from `@keylow/core/copy`. */
  title: string;
  /** One more sentence, from `@keylow/core/copy` too: what to do or what still works. */
  body?: string | undefined;
  /** Tries again, drawn as a secondary button. A failure that retries itself, such as a search that runs again when the query changes, has none. */
  retry?: ErrorStateRetry | undefined;
};
