import { Canvas } from "@shopify/react-native-skia";
import { cssInterop } from "nativewind";

// The canvas takes its size from a class, like every other view in the kit, because a `style` prop on it
// would be an inline style.
cssInterop(Canvas, { className: "style" });

export { Canvas as StyledCanvas };
