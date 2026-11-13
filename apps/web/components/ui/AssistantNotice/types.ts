import type { LucideIcon } from "lucide-react";

/** `neutral` is a notice about a limit or a switch. `danger` is a failed turn, with a danger border, tile and icon. */
export type AssistantNoticeTone = "neutral" | "danger";

export type AssistantNoticeButton = {
  label: string;
  /** Dims the button and stops it responding. */
  isDisabled?: boolean | undefined;
  onClick: () => void;
};

export type AssistantNoticeProps = {
  icon: LucideIcon;
  /** Defaults to `neutral`. */
  tone?: AssistantNoticeTone | undefined;
  title: string;
  /** Each is drawn as given, in order. */
  paragraphs: readonly string[];
  /** Full-width buttons under the words, one above the next. */
  buttons?: readonly AssistantNoticeButton[] | undefined;
};
