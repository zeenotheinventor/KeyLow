import { CONFIRM_COPY_BUTTONS, describeConfirmCopyQuestion } from "../../copy/assistantDayCards";

/** The two buttons under the model's own question, and a formatter for that question the turn loop may use. */
export const confirmCopyButtons = (count: number) => ({
  confirmLabel: CONFIRM_COPY_BUTTONS.confirm(count),
  cancelLabel: CONFIRM_COPY_BUTTONS.cancel,
});

type ConfirmCopyDays = {
  /** The day copied from, and the day copied onto, as `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** The person's today, which decides whether a day is called "yesterday" or "today". */
  today: string;
  existingCount: number;
  copyingCount: number;
};

/** "Today already has 3 entries. Add yesterday's 8 entries to them? Nothing is replaced." */
export const confirmCopyQuestion = ({
  from,
  to,
  today,
  existingCount,
  copyingCount,
}: ConfirmCopyDays): string =>
  describeConfirmCopyQuestion(from, to, today, existingCount, copyingCount);
