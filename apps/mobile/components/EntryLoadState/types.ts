export type EntryLoadStateProps = {
  state: "loading" | "error" | "notFound";
  /** The header's title: the screen the person is waiting for. */
  title: string;
  /** Back on the header. */
  onBack: () => void;
  /** Tries the read again, from the failure's button. */
  onRetry: () => void;
};
