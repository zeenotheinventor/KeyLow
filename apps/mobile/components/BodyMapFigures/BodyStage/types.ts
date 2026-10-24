import type { BodyViewProps } from "../../BodyView";
import type { GestureResponderHandlers } from "react-native";

/** What the stage takes: the props of the body it holds, but for the width, which the stage decides, and the phase, which it reads itself. */
export type BodyStageProps = Omit<BodyViewProps, "w" | "onPhaseChange"> & {
  /**
   * The touch handlers that turn a tap on the 2D figure into a tap. The stage puts them on itself only while the 3D body has
   * not drawn, because once it has, the 3D body takes the touch and the two would both fire.
   */
  tapHandlers?: GestureResponderHandlers | undefined;
};
