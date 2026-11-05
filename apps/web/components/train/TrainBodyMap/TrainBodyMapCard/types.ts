import type { BodyFigureValues } from "@/components/ui/BodyFigure";
import type { BodyArtworkFigure, BodyMapView } from "@keylow/core/training";

export type TrainBodyMapCardProps = {
  /** The view shown, which the figures' labels name. */
  view: BodyMapView;
  /** The heat step of each muscle in the view shown. A muscle left out is drawn at rest. */
  values: BodyFigureValues;
  /** The figure drawn, from the figure setting. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** The view named, such as "Actual". */
  viewLabel: string;
  /** The line under the view: the moment shown, or why there is nothing to show. */
  subLine: string;
  /** The toggle button's label, naming the view it switches to: "Show projected" or "Show actual". */
  toggleLabel: string;
  /** False when Projected cannot be shown, which disables the button. */
  isToggleEnabled: boolean;
  /** The line under the figures, or null for none: why Projected is off. */
  note: string | null;
  /** The warmest muscles now, or null for none. It is the heat now, so only Actual has it. */
  warmLine: string | null;
  /** Called when the button asks for the other view. */
  onToggle: () => void;
};
