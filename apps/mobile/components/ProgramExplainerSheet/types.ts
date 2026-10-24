export type ProgramExplainerSheetProps = {
  open: boolean;
  /** Done, the dim, a drag down, the screen reader's escape or the back button. */
  onClose: () => void;
  /**
   * The date of the programme's check-in, `YYYY-MM-DD`, whose weekday the weekly check-in section names. It is
   * the programme's next check-in date, or its start date while it has none.
   */
  checkInDate: string;
};
