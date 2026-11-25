import { Pressable } from "react-native";

import { Text } from "../../ui";

import type { AuthLinkProps } from "./types";

/**
 * The auth boards' body size link: semibold, underlined, in the primary text colour, at least the touch
 * target tall. The line under the buttons and the Forgot password link both draw it, so the two cannot
 * drift. The link is the pressable's, because a class on the link's own text is not read on a device.
 */
export function AuthLink({ label, onPress }: AuthLinkProps) {
  return (
    <Pressable className="min-h-touch-target justify-center px-1" role="link" onPress={onPress}>
      <Text className="underline" variant="body-strong">
        {label}
      </Text>
    </Pressable>
  );
}
