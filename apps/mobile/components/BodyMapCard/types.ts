import type { BodyMapSideBySide } from "../BodyMapFigures";
import type { BodyFigureValues } from "../ui";
import type { BodyMapScale } from "@keylow/core/copy";
import type {
  BodyArtworkFigure,
  BodyArtworkSide,
  BodyMapView,
  MuscleId,
} from "@keylow/core/training";
import type { ReactNode } from "react";

export type BodyMapCardProps = {
  /** The scale the figures are coloured by. */
  scale: BodyMapScale;
  /** The view shown. On Gap, which has no Actual or Projected, both views hold the same numbers and the label is not Projected. */
  view: BodyMapView;
  /** The value of each muscle in Actual, as `useBodyMap` gives them for the scale. A muscle left out is drawn at rest. */
  actualValues: BodyFigureValues;
  /** The value of each muscle in Projected. A muscle left out is drawn at rest. */
  projectedValues: BodyFigureValues;
  /** The figure drawn, from the figure setting. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** The view named, such as "Actual". */
  viewLabel: string;
  /** The line under the view: the moment shown, or why there is nothing to show. */
  subLine: string;
  /** The toggle button's label, naming the view it switches to: "Show projected" or "Show actual". Null draws no button. */
  toggleLabel: string | null;
  /** False when Projected cannot be shown, which disables the button and the tap on the figures. */
  isToggleEnabled: boolean;
  /** Called when the button or a tap on the figures asks for the other view. */
  onToggle: () => void;
  /** A line under the button, or null for none: why the two views match, or why Projected is off. */
  note: string | null;
  /** The muscle outlined, whose sheet is open. */
  selected?: MuscleId | undefined;
  /** The view whose figure the selected muscle is outlined on in the side by side view. */
  selectedView?: BodyMapView | undefined;
  /** Called when a muscle is pressed and held, with the view of the figure it was on. Left out, the figures are plain images. */
  onLongPressMuscle?: ((muscle: MuscleId, view: BodyMapView) => void) | undefined;
  /** Draws the side by side view: Actual and Projected together, in place of the view label and the front and back. */
  sideBySide?: BodyMapSideBySide | undefined;
  /** Called when the Front and Back switch of the side by side view picks a side. */
  onSideChange?: ((side: BodyArtworkSide) => void) | undefined;
  /** Called when the Show side by side button is pressed. Left out, the card has no such button, as on Volume and Gap. */
  onToggleSideBySide?: (() => void) | undefined;
  /** False turns the Show side by side button off, as when there is no routine for Projected to show. Defaults to true. */
  isSideBySideEnabled?: boolean | undefined;
  /** Laid over the figures, such as the first-open hint. It positions itself. */
  overlay?: ReactNode;
};
