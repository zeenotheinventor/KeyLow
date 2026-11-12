import { cssInterop } from "nativewind";
import { ScrollView } from "react-native-gesture-handler";

// The gesture handler's scroll view is its own component, so its classes are mapped to styles as the plain scroll
// view's are. The table scrolls in this one so that the sheet's drag, which gesture handler arbitrates, cannot
// take a sideways swipe from it.
cssInterop(ScrollView, { className: "style" });

export { ScrollView as TableScrollView };
