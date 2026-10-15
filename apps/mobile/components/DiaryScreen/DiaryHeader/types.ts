export type DiaryHeaderProps = {
  /** "Today", or the day such as "Wed 14 Oct". */
  title: string;
  chooseDateLabel: string;
  moreLabel: string;
  /** Opens the date picker. The header draws the button without it while the diary is still loading its time zone. */
  onChooseDate?: (() => void) | undefined;
  /** Opens the menu with Copy yesterday. */
  onMore?: (() => void) | undefined;
};
