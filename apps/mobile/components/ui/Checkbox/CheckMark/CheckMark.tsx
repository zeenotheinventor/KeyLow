import Animated from "react-native-reanimated";

import { usePunchStyle } from "./usePunchStyle";
import { Icon } from "../../Icon";

/** The tick in a ticked box. It is drawn only while the box is ticked, so it arrives each time it is. */
export function CheckMark() {
  const punchStyle = usePunchStyle();

  // A class and an animated style cannot share an element, so the punch sits on a wrapper with no class.
  return (
    <Animated.View style={punchStyle} testID="check-punch">
      <Icon name="Check" size="sm" tone="accent-foreground" />
    </Animated.View>
  );
}
