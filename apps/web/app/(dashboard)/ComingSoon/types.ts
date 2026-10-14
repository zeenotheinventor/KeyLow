import type { LucideIcon } from "lucide-react";

export type ComingSoonProps = {
  title: string;
  /** The page's own icon. Pages that have none drawn show an hourglass. */
  icon?: LucideIcon;
  /** One line saying what will appear here. */
  body?: string;
};
