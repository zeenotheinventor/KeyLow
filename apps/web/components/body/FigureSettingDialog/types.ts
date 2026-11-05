import type { BodyArtworkFigure } from "@keylow/core/training";

export type FigureSettingDialogProps = {
  open: boolean;
  /** Called for Done, the Close button, Escape and a press on the dimmed page. */
  onClose: () => void;
  /** The figure drawn now, which the choice shows and the preview draws. */
  figure: BodyArtworkFigure;
  /** Called with the figure picked. The dialog stays open, so the preview shows the choice before Done. */
  onChange: (figure: BodyArtworkFigure) => void;
};
