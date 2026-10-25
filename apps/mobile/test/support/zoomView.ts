import { WHOLE_BODY_VIEW } from "@keylow/body-3d/zoom";
import { makeMutable } from "react-native-reanimated";

import type { ZoomView } from "@keylow/body-3d/zoom";
import type { SharedValue } from "react-native-reanimated";

// The width over height of the 200 by 440 drawing that the body is framed for.
export const FRAME_ASPECT = 200 / 440;

// The zoom and pan of a body that has not been zoomed, as the canvas reads them.
export const wholeBodyView = (): SharedValue<ZoomView> => makeMutable(WHOLE_BODY_VIEW);
