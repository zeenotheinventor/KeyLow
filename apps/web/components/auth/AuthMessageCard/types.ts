import type { LucideIcon } from "lucide-react";
import type * as React from "react";

export type AuthMessageTone = "neutral" | "danger" | "success";

export type AuthMessageAction = {
  label: string;
  href: string;
};

export type AuthMessageCardProps = {
  /** Neutral and success are announced as a status, danger as an alert. */
  tone: AuthMessageTone;
  icon: LucideIcon;
  title: string;
  body: string;
  primaryAction?: AuthMessageAction | undefined;
  secondaryAction?: AuthMessageAction | undefined;
  /** What follows the buttons, such as the sent page's note and Send again. */
  footer?: React.ReactNode;
  /** The title takes focus when asked, so a screen reader is moved to the new message. */
  titleRef?: React.Ref<HTMLHeadingElement>;
};
