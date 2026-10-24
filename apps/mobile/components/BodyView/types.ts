import type { BodyFigureProps } from "../ui";
import type { BodyArtworkSide } from "@keylow/core/training";
import type { ThemeScheme } from "@keylow/tokens";

/** Where the 3D body is in drawing: the 2D figure shows while it loads, it fades in once it has drawn, and it failed if the 2D figure stays for good. */
export type BodyViewPhase = "loading" | "drawn" | "failed";

/**
 * `BodyView` takes the props of `BodyFigure` and swaps one for the other. The 3D body reads the same value
 * props (`scale`, `values`, `selected`, `dim`, `unselectedOpacity`), the `label` and the width, and the
 * three that only it has: the 2D figure draws no turn and no tap of its own and leaves them out.
 */
export type BodyViewProps = BodyFigureProps & {
  /** Called when a drag of the 3D body settles on the side that is not `side`, so the control that shows the side keeps in step. */
  onSideChange?: ((side: BodyArtworkSide) => void) | undefined;
  /** Called once for a touch on the 3D body that lifts within the tap slop of where it went down. A drag never calls it. */
  onTap?: (() => void) | undefined;
  /**
   * The scheme to draw the 3D body in, for a stage that is dark in both themes. The 2D figure keeps the app's
   * theme, since it shows on the clear stage. Left out, the 3D body takes the app's theme.
   */
  bodyScheme?: ThemeScheme | undefined;
  /**
   * The width in points of the area the 3D body takes a drag and a tap on, centred on the body, for a stage wider
   * than it. The turn is still half a turn for a drag across the body's width. The 3D body's width unless given, and the 2D figure leaves it out.
   */
  touchWidth?: number | undefined;
  /** Called with where the 3D body is in drawing, so the stage around it can show that it is loading. */
  onPhaseChange?: ((phase: BodyViewPhase) => void) | undefined;
};
