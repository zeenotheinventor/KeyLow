// The diary dialogs keep one size through their steps, as the boards draw it: from 700 px they stand 64 px
// from the top and the bottom of the window, so the add dialog does not jump when it goes from the search to
// the portion step, and the Time field has room for its picker. Below 700 px a dialog fills the screen.
export const DIARY_DIALOG_CLASSES =
  "min-[700px]:h-[calc(100%-theme(spacing.16)-theme(spacing.16))]";
