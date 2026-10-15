export type DiaryLoadingProps = {
  isOnline: boolean;
  /** Draws the week's pills in the skeleton too, for the first load, when no strip is on screen. */
  includesWeek: boolean;
};
