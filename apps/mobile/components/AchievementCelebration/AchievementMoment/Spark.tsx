import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useSparkStyle } from "./useMomentMotion";

type SparkProps = {
  /** Where the spark ends up, in points from the middle of the ring. */
  x: number;
  y: number;
  /** The fill class, written out where it is used so Tailwind sees it. */
  className: string;
};

/** One of the little squares that drift out from the ring. Decoration. */
export function Spark({ x, y, className }: SparkProps) {
  const animatedStyle = useSparkStyle(x, y);

  return (
    <View aria-hidden className="absolute left-1/2 top-1/2">
      {/* A class and an animated style cannot share an element, so the drift sits on a wrapper with no class. */}
      <Animated.View style={animatedStyle}>
        <View className={`-ml-1 -mt-1 h-2 w-2 rounded-[2px] ${className}`} />
      </Animated.View>
    </View>
  );
}
