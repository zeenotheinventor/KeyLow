import type { BodyFigureProps } from "../BodyFigure";
import type { BodyColours, BodyLightingScheme, Look, LookEmphasis } from "@keylow/body-3d";
import type { BodySide } from "@keylow/body-3d/rotation";
import type { ZoomView } from "@keylow/body-3d/zoom";
import type { MuscleId } from "@keylow/core/training";
import type { SharedValue } from "react-native-reanimated";

/**
 * The value props of `BodyFigure`, with the same meaning and defaults, so a caller swaps one figure for the other
 * with no other change. `scale` is heat and `values` is empty by default, which is every muscle at rest.
 */
export type Body3DProps = Partial<
  Pick<BodyFigureProps, "scale" | "values" | "selected" | "dim" | "unselectedOpacity">
> & {
  /** The figure's accessible name, from core copy. */
  label: string;
  /** The width in points. The height follows from the 200 by 440 drawing of `BodyFigure`. */
  w: number;
  /**
   * The width in points of the area that takes the drag and the tap, centred on the body, so a stage wider than the
   * body is all touch surface. The turn is still half a turn for a drag across the body's width. Never narrower than `w`, which it is by default.
   */
  touchWidth?: number | undefined;
  /**
   * The side the body faces. When it changes the body turns there by the shorter arc, over the standard motion
   * duration, or at once with reduced motion. A drag turns the body too, and on release it settles on the nearer
   * side. Front by default.
   */
  side?: BodySide | undefined;
  /**
   * Called when a drag is released and the body settles on the side that is not `side`, so a control that shows the
   * side stays in step. Not called while the finger moves, and not because `side` changed.
   */
  onSideChange?: ((side: BodySide) => void) | undefined;
  /** Called once for a touch that lifts within 10 points of where it went down. A drag never calls it. */
  onTap?: (() => void) | undefined;
  /**
   * Called with the zoom, to one decimal place, when a pinch or a two-finger pan lets go and when a reset starts,
   * and only when it differs from the zoom it last reported, so the pill that shows it renders when the zoom
   * is settled and not while the fingers move. 1 is the whole body, and 2 the closest.
   */
  onZoomChange?: ((zoom: number) => void) | undefined;
  /**
   * The number of resets asked for. Raising it eases the zoom and the pan back to the whole body over the standard
   * motion duration, or at once with reduced motion. A count that is not raised does nothing, and the count a
   * body starts with is not a reset. 0 by default.
   */
  zoomResetCount?: number | undefined;
  /** Called once, when the first frame of the body has been drawn. Never called if nothing is drawn. */
  onFirstFrame?: (() => void) | undefined;
  /** Called once if the body cannot be drawn: GL is missing, the model cannot be read, or the draw throws. */
  onError?: (() => void) | undefined;
};

/** What the GL canvas takes. `Body3D` fills it from the theme and its own callbacks. */
export type Body3DCanvasProps = {
  /** The colours of everything but the muscles, and the one the muscles start at. */
  colours: BodyColours;
  scheme: BodyLightingScheme;
  /** The look of each muscle. The muscles ease to a new one. */
  looks: Record<MuscleId, Look>;
  emphasis: LookEmphasis;
  /** How long the muscles take to ease to a new look, in milliseconds. 0 changes them at once. */
  fadeMilliseconds: number;
  /**
   * The turn of the body about its vertical axis, in radians, 0 facing the front. The render loop reads it every
   * frame, and a change asks for a frame, so a turn re-renders nothing in React.
   */
  yaw: SharedValue<number>;
  /**
   * The zoom, and how far the zoomed body is moved on the stage in points, as `@keylow/body-3d/zoom` has them. It is read by the render loop every frame like `yaw`, with the same asks for a frame. The canvas is as
   * wide as the touch area, and the camera zooms about the middle of it.
   */
  view: SharedValue<ZoomView>;
  /** The width over height that the body is framed for: the body's own, however much wider the canvas is. */
  frameAspect: number;
  /** Called once, when the first frame has been asked for. */
  onFirstFrame?: (() => void) | undefined;
  /** Called when a shader cannot be linked, which three.js otherwise only logs while it draws nothing. */
  onError?: (() => void) | undefined;
};
