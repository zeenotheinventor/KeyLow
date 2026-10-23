// The diary dialogs keep one size through their steps, as the boards draw it: from 700 px they stand 64 px
// from the top and the bottom of the window, so the add dialog does not jump when it goes from the search to
// the portion step, and the Time field has room for its picker. Below 700 px a dialog fills the screen.
export const DIARY_DIALOG_CLASSES =
  "min-[700px]:h-[calc(100%-theme(spacing.16)-theme(spacing.16))]";

// The amount step of a recipe adds the per 100 g list, so from 700 px the dialog stands 32 px from the top and
// the bottom of the window instead of 64, as the web-diary recipe boards draw it, to keep the Time field in view.
export const DIARY_RECIPE_AMOUNT_DIALOG_CLASSES =
  "min-[700px]:h-[calc(100%-theme(spacing.8)-theme(spacing.8))]";
