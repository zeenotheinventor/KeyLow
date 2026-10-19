import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useCrossFade } from "../../lib/motion";
import { Text } from "../ui";

import type { ViewLabelProps } from "./types";

type ViewName = Pick<ViewLabelProps, "label" | "isProjected">;

// The board's dot is 8 across with a 1.5 border: filled for Actual, a dashed ring for Projected.
function ViewName({ label, isProjected = false }: ViewName) {
  return (
    <View className="flex-row items-center gap-2">
      <View
        aria-hidden
        className={`h-2 w-2 rounded-full border-[1.5px] border-text-primary ${isProjected ? "border-dashed bg-transparent" : "bg-text-primary"}`}
      />
      <Text variant="body-strong">{label}</Text>
    </View>
  );
}

/**
 * The line that names the view the body map shows, with the moment it shows beside it. Only the view's name
 * is a polite live region, so a screen reader hears the view named when it changes. The moment ticks with
 * the clock, so it stays outside the region, where TalkBack would announce it again every minute. The dot
 * is decoration. When the name changes the old name fades out over the new one, as the toggle board draws,
 * and the old one is hidden from a screen reader so only the new name is read.
 */
export function ViewLabel({ label, subLine, isProjected = false }: ViewLabelProps) {
  const { outgoing, incomingStyle, outgoingStyle } = useCrossFade({ label, isProjected }, label);
  // Only a fade in progress styles the new layer; at rest it is drawn plain.
  const incomingLayerStyle = outgoing === null ? undefined : incomingStyle;

  return (
    <View className="gap-[2px]">
      <View accessible aria-live="polite" role="status">
        {outgoing === null ? null : (
          <View aria-hidden className="absolute left-0 top-0" pointerEvents="none">
            <Animated.View style={outgoingStyle}>
              <ViewName {...outgoing} />
            </Animated.View>
          </View>
        )}
        <Animated.View style={incomingLayerStyle}>
          <ViewName isProjected={isProjected} label={label} />
        </Animated.View>
      </View>
      <Text tone="muted" variant="caption">
        {subLine}
      </Text>
    </View>
  );
}
