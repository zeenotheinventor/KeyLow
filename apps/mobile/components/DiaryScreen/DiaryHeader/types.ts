import type { StreakLine } from "@keylow/core/diary";

export type DiaryHeaderProps = {
  /** "Today", or the day such as "Wed 14 Oct". */
  title: string;
  /**
   * The streak line under the title, from core's `streakLineOf`, or null/undefined for none (a day
   * outside the streak window, or a streak that is not known yet).
   */
  streakLine?: StreakLine | null | undefined;
  /** The Assistant button's name, before the calendar. */
  assistantLabel: string;
  chooseDateLabel: string;
  moreLabel: string;
  /** Opens the assistant sheet. Drawn without it while the diary is still loading its time zone, because the assistant needs the day. */
  onAssistant?: (() => void) | undefined;
  /** Opens the date picker. The header draws the button without it while the diary is still loading its time zone. */
  onChooseDate?: (() => void) | undefined;
  /** Opens the menu with Copy yesterday. */
  onMore?: (() => void) | undefined;
};
