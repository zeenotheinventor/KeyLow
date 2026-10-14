import { AUTH_SCREEN } from "@keylow/core/copy";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useSpinStyle } from "../../lib/motion";
import { KiLoMark } from "../KiLoMark";
import { Icon, Text } from "../ui";

/**
 * What the auth callback shows while an email link is being opened, as the signing-in-link board draws it:
 * the Ki-Lo mark at 64 points and a turning ring beside "Signing you in", centred on the background. It is
 * a status, so a screen reader says it as it appears.
 */
export function SigningInLink() {
  const spinStyle = useSpinStyle();

  return (
    <View
      accessible
      aria-live="polite"
      className="flex-1 items-center justify-center gap-4 bg-background"
      role="status"
    >
      <KiLoMark size={64} />
      <View className="flex-row items-center gap-2">
        {/* A class and an animated style cannot share an element, so the ring turns on a wrapper with no class. */}
        <Animated.View style={spinStyle}>
          <Icon name="LoaderCircle" tone="accent-ink" />
        </Animated.View>
        <Text tone="secondary">{AUTH_SCREEN.signingInLink}</Text>
      </View>
    </View>
  );
}
