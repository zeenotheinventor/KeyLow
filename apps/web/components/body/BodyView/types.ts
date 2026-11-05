import type { BodyFigureProps } from "@/components/ui/BodyFigure";
import type { BodyArtworkSide } from "@keylow/core/training";

/** Where the 3D body is in drawing: the 2D figure shows while it loads, it fades in once it has drawn, and it failed if the 2D figure stays for good. */
export type BodyViewPhase = "loading" | "drawn" | "failed";

/**
 * `BodyView` takes the props of `BodyFigure` and swaps one for the other. The 3D body reads the same value
 * props (`scale`, `values`, `selected`, `dim`, `unselectedOpacity`), the `label` and the width, and the
 * calls that only it makes. A hold on a muscle is `onLongPressMuscle`, which the 2D figure makes with a
 * button for each muscle and the 3D body makes by picking the muscle under the pointer, through the skin.
 */
export type BodyViewProps = BodyFigureProps & {
  /** Called when a drag of the 3D body settles on the side that is not `side`, so the control that shows the side keeps in step. */
  onSideChange?: ((side: BodyArtworkSide) => void) | undefined;
  /** Called once for a press on the 3D body that lifts within the tap slop of where it went down. A drag never calls it. */
  onTap?: (() => void) | undefined;
  /** Called with the zoom of the 3D body, to one decimal place, when a pinch lets go and when a reset or a step starts. 1 is the whole body. */
  onZoomChange?: ((zoom: number) => void) | undefined;
  /** Raise it to ease the 3D body back to the whole body, centred. See `Body3D`. */
  zoomResetCount?: number | undefined;
  /** Raise it to step the 3D body half a zoom closer. See `Body3D`. */
  zoomInCount?: number | undefined;
  /** Raise it to step the 3D body half a zoom back. See `Body3D`. */
  zoomOutCount?: number | undefined;
  /** The width in pixels of the area the 3D body takes a drag, a pinch and a press on, centred on the body, for a stage wider than it. The body's width unless given. */
  touchWidth?: number | undefined;
  /** Called with where the 3D body is in drawing, so the stage around it can show that it is loading. */
  onPhaseChange?: ((phase: BodyViewPhase) => void) | undefined;
};
