export type ThisWeekMessageProps = {
  /** The week's Monday, `YYYY-MM-DD`, for the caption under the title. */
  weekStart: string;
} & (
  | {
      /** The week could not be loaded: the card says so and offers Try again. */
      kind: "failed";
      onRetry: () => void;
    }
  | {
      /** The phone is offline and no week is on hand. */
      kind: "offline";
    }
);
