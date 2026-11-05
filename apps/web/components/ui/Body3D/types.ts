import type { BodyFigureProps } from "../BodyFigure";
import type { BodySide } from "@keylow/body-3d/rotation";
import type { TouchPoint } from "@keylow/body-3d/touch";
import type { MuscleId } from "@keylow/core/training";

/**
 * Names the muscle drawn at a point of the touch area, in pixels from its top left, or null where there is none or a
 * muscle with no id. The canvas makes it from the camera and the body as they are drawn.
 */
export type MusclePicker = (point: TouchPoint) => MuscleId | null;

/**
 * The value props of `BodyFigure`, with the same meaning and defaults, so a caller swaps one figure for the other.
 * `scale` is heat and `values` is empty by default, which is every muscle at rest.
 */
export type Body3DProps = Partial<
  Pick<BodyFigureProps, "scale" | "values" | "selected" | "dim" | "unselectedOpacity">
> & {
  /** The figure's accessible name, from core copy. */
  label: string;
  /** The width in pixels. The height follows from the 200 by 440 drawing of `BodyFigure`. */
  w: number;
  /**
   * The width in pixels of the area that takes the drag, the pinch, the tap and the hold, centred on the body, so a
   * stage wider than the body is all touch surface. The turn is still half a turn for a drag across the body's
   * width. Never narrower than `w`, which it is by default.
   */
  touchWidth?: number | undefined;
  /**
   * The side the body faces. When it changes the body turns there by the shorter arc, over 220 ms, or at once with
   * reduced motion. A drag turns the body too, and on release it settles on the nearer side. Front by default.
   */
  side?: BodySide | undefined;
  /**
   * Called when a drag is released and the body settles on the side that is not `side`, so a control that shows the
   * side stays in step. Not called while the pointer moves, and not because `side` changed.
   */
  onSideChange?: ((side: BodySide) => void) | undefined;
  /** Called once for a press that lifts within 10 pixels of where it went down. A drag or a hold never calls it. */
  onTap?: (() => void) | undefined;
  /**
   * Called once with the muscle under the pointer when it has stayed down for 500 ms within the tap slop of where it
   * went down, through the skin, with the turn, the zoom and the pan in effect. Not called for a point on a muscle with
   * no id or on nothing, or for a drag, a pinch or a second finger. A press that fired it is not a tap. Left out,
   * the body takes no hold.
   */
  onLongPressMuscle?: ((muscle: MuscleId) => void) | undefined;
  /**
   * Called with the zoom, to one decimal place, when a pinch or a trackpad pinch lets go and when a reset or a step
   * starts, and only when it differs from the zoom it last reported. 1 is the whole body, and 2 the closest. A pinch
   * is two fingers on touch, or the wheel with ctrl held on a trackpad. A plain wheel scrolls the page and is not handled.
   */
  onZoomChange?: ((zoom: number) => void) | undefined;
  /**
   * The number of resets asked for. Raising it eases the zoom and the pan back to the whole body over 220 ms, or at
   * once with reduced motion. A count that is not raised does nothing, and the count a body starts with is not a
   * reset. 0 by default.
   */
  zoomResetCount?: number | undefined;
  /** The number of steps closer asked for, each half a zoom closer to a most of 2, eased like a reset. 0 by default. */
  zoomInCount?: number | undefined;
  /** The number of steps back asked for, each half a zoom back to a least of 1, eased like a reset. 0 by default. */
  zoomOutCount?: number | undefined;
  /** Called once, when the first frame of the body has been drawn. Never called if nothing is drawn. */
  onFirstFrame?: (() => void) | undefined;
  /**
   * Called once if the body cannot be drawn: there is no WebGL, the context is lost, or the model cannot be read.
   * Nothing is written on screen, so the caller draws the 2D figure in its place.
   */
  onError?: (() => void) | undefined;
};
