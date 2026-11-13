import type { RecipeDraftCardFigure } from "@keylow/core";

export type TargetFiguresProps = {
  /** "Per serving". */
  label: string;
  figures: readonly RecipeDraftCardFigure[];
};
