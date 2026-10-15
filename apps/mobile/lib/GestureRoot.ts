import { cssInterop } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// A screen that mounts a BottomSheet needs a gesture handler root above it, and the app has none at its root. The
// root view takes its layout as a class, as the kit's other native views do.
cssInterop(GestureHandlerRootView, { className: "style" });

export { GestureHandlerRootView as GestureRoot };
