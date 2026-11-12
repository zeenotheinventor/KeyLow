import type { BodyViewProps } from "@/components/body/BodyView";
import type { BodyArtworkSide } from "@keylow/core/training";

/**
 * What the stage takes: the props of the body it holds, but for the width, the zoom and the phase, which the stage
 * decides or reads itself, and the side, which the control under the stage sets and a drag of the body does too.
 */
export type BodyStageProps = Omit<
  BodyViewProps,
  | "w"
  | "side"
  | "onSideChange"
  | "touchWidth"
  | "onZoomChange"
  | "zoomResetCount"
  | "zoomInCount"
  | "zoomOutCount"
  | "onPhaseChange"
  | "onPressMuscle"
> & {
  /** The side the body faces. */
  side: BodyArtworkSide;
  /** Called when the Front and Back control is pressed, and when a drag of the body settles on the other side. */
  onSideChange: (side: BodyArtworkSide) => void;
};
