import type { BodyArtworkFigure } from "@keylow/core/training";

export type FigureSettingSheetProps = {
  open: boolean;
  /** Called when the sheet is closed: Done, the dim, a drag down or the back button. */
  onClose: () => void;
  /** The figure drawn now, which the choice shows and the preview draws. */
  figure: BodyArtworkFigure;
  /** Called with the figure pressed. The sheet stays open, so the preview shows the choice before Done. */
  onChange: (figure: BodyArtworkFigure) => void;
};
