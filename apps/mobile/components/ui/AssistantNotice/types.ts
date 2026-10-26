import type { IconName } from "../Icon";

/**
 * `neutral` is a notice about a limit or a switch. `danger` is a failed turn, with a danger border, tile
 * and icon. `accent` is the consent card, with an accent tile and icon.
 */
export type AssistantNoticeTone = "neutral" | "danger" | "accent";

export type AssistantNoticeButtonKind = "primary" | "secondary" | "danger" | "ghost";

export type AssistantNoticeButton = {
  label: string;
  kind: AssistantNoticeButtonKind;
  onPress: () => void;
};

export type AssistantNoticeProps = {
  icon: IconName;
  /** Defaults to `neutral`. */
  tone?: AssistantNoticeTone | undefined;
  title: string;
  /** Each is drawn as given, in order. */
  paragraphs: readonly string[];
  /** An underlined line of text under the paragraphs, such as "Privacy policy". */
  link?: { label: string; onPress: () => void } | undefined;
  /** The caption under the link, such as the not-medical-advice line. */
  smallPrint?: string | undefined;
  /** Full-width buttons under everything else, one above the next. */
  buttons?: readonly AssistantNoticeButton[] | undefined;
};
