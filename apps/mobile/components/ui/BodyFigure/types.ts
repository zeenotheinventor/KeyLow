import type { BodyArtworkFigure, BodyArtworkSide, MuscleId } from "@keylow/core/training";

/**
 * Which colour scale the figure is drawn in: the body map's three, and the role of each muscle in an
 * exercise, which only the "Muscles it works" sheet uses.
 */
export type BodyFigureScale = "heat" | "volume" | "gap" | "role";

/**
 * The value of each muscle, as the body map values of core encode it: a heat step from 0 to 5 on the
 * heat scale, the index in `VOLUME_STATUSES` on the volume scale, the index in `GAP_VALUES` on the
 * gap scale, and the value of `ROLE_FIGURE_VALUES` on the role scale. A muscle left out is at rest on
 * heat, not trained on volume, not in the plan on gap and not worked on role.
 */
export type BodyFigureValues = Partial<Record<MuscleId, number>>;

export type BodyFigureProps = {
  /** The side of the body to draw. */
  side: BodyArtworkSide;
  scale: BodyFigureScale;
  values: BodyFigureValues;
  /** The figure to draw. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** The muscle to outline in the primary text colour. */
  selected?: MuscleId | undefined;
  /** The opacity of the whole figure, from 0 to 1, as the canvas component's `dim` has it. Defaults to 1. */
  dim?: number;
  /**
   * The opacity of every muscle but the selected one, from 0 to 1, so the selected muscle stands out from
   * the rest while its sheet is open. Unlike `dim` it leaves the selected muscle and its outline at full
   * strength. Defaults to 1, and does nothing without a selected muscle.
   */
  unselectedOpacity?: number;
  /** The figure's accessible name, from core copy. */
  label: string;
  /** The width in points. The height follows from the 200 by 440 drawing. */
  w: number;
  /** Gives each muscle a button. Leave both handlers out for a plain image, as the small cards do. */
  onPressMuscle?: (muscle: MuscleId) => void;
  onLongPressMuscle?: (muscle: MuscleId) => void;
};
