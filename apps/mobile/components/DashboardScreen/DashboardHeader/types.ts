import type { ReactNode } from "react";

export type DashboardHeaderProps = {
  /** Today's date in words, such as "Thursday 15 October". Left off until the profile's time zone is known. */
  eyebrow?: string | undefined;
  /** The screen's name, which is also its heading for a screen reader. */
  title: string;
  /** What sits at the end of the title's line: the streak chip, once the streak is known. */
  trailing?: ReactNode;
};
