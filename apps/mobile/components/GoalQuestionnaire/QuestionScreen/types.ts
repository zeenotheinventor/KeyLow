import type { ReactNode } from "react";

export type QuestionScreenProps = {
  /** The question's number, from 1 to 6. It words the caption and fills the progress bar. */
  step: number;
  /** The question, in the h1. */
  title: string;
  /** The one help line under the question. */
  help: string;
  /** The line under the answers, or `null` for a question that has none. */
  note: string | null;
  /** Whether the question holds an answer the schema accepts. Next is disabled until it does. */
  isNextEnabled: boolean;
  /** Close at the left of the header. It says the answers are not saved, and the caller asks before it leaves. */
  onClose: () => void;
  /** Back in the footer. Left out on the first question. */
  onBack?: (() => void) | undefined;
  onNext: () => void;
  /** The question's answers, which scroll between the fixed header and the fixed footer. */
  children: ReactNode;
};
