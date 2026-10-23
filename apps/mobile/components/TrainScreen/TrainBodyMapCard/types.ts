import type { BodyFigureValues } from "../../ui";
import type { BodyArtworkFigure, BodyMapView } from "@keylow/core/training";

export type TrainBodyMapCardProps = {
  /** The view shown, which the figures' labels name. */
  view: BodyMapView;
  /** The heat step of each muscle in the view shown, as `useBodyMap` gives them. A muscle left out is drawn at rest. */
  values: BodyFigureValues;
  /** The figure drawn, from the figure setting. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** The view named, such as "Actual". */
  viewLabel: string;
  /** The line under the view: the moment shown, or why there is nothing to show. */
  subLine: string;
  /** The toggle button's label, naming the view it switches to: "Show projected" or "Show actual". */
  toggleLabel: string;
  /** False when Projected cannot be shown, which dims the button and stops it responding. */
  isToggleEnabled: boolean;
  /** The line under the figures, or null for none: why Projected is off. */
  note: string | null;
  /** Called when the button asks for the other view. */
  onToggle: () => void;
  /** Opens the body map: the chevron button. Drawn only when it is given. */
  onOpenBodyMap?: (() => void) | undefined;
};
