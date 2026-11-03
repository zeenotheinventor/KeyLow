export type AssistantSheetProps = {
  open: boolean;
  /** Called after a close of any kind (the Close button, a drag down, the dim, the back button), once a streaming answer was stopped. */
  onClose: () => void;
  /**
   * The day on view in the diary, `YYYY-MM-DD` in the person's time zone. The assistant is told this is the
   * day they are looking at, and logs to it when they name no other.
   */
  localDate: string;
  /**
   * Opens the sheet from Describe in Log food: the time of day, `HH:MM`, the described food is logged at
   * (`assistant · describe`). It opens at full height with the field focused, says the time over the field,
   * and sends it with each message. Leave it out when the sheet is opened from the diary.
   */
  describeAt?: string | undefined;
};
