import type {
  BodyArtworkFigure,
  BodyArtworkSide,
  BodyFigureScale,
  MuscleId,
} from "@keylow/core/training";

export type { BodyFigureScale };

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
  /** The opacity of the whole figure, from 0 to 1. Defaults to 1. */
  dim?: number;
  /**
   * The opacity of every muscle but the selected one, from 0 to 1, so the selected muscle stands out from
   * the rest while its details are open. Unlike `dim` it leaves the selected muscle and its outline at
   * full strength. Defaults to 1, and does nothing without a selected muscle.
   */
  unselectedOpacity?: number;
  /** The figure's accessible name, from core copy. */
  label: string;
  /** The width in pixels. The height follows from the 200 by 440 drawing. */
  w: number;
  /**
   * Gives each muscle a button, reached by Tab. A click on a muscle calls this, and Enter or Space does
   * unless `onLongPressMuscle` is also given. Leave both handlers out for a plain image, as the small cards do.
   */
  onPressMuscle?: (muscle: MuscleId) => void;
  /**
   * Called when a pointer is held on a muscle, and when Enter or Space is pressed on it, so the details
   * are reached without a pointer. A hold is not followed by a click.
   */
  onLongPressMuscle?: (muscle: MuscleId) => void;
};
