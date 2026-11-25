import { Link } from "expo-router";
import { Pressable, Text as NativeText, View } from "react-native";

import { useTheme } from "../../../lib/theme";
import { Text } from "../../ui";
import { AuthLink } from "../AuthLink";

import type { AuthFooterProps } from "./types";

/**
 * The line under the buttons that links to the other of the two screens. The link is the pressable's,
 * because a class on the link's own text is not read on a device. The caption size draws the link in the
 * accent ink as the checkbox links are: lime in dark and the primary text colour in light.
 */
export function AuthFooter({ footer, size = "body", onPress }: AuthFooterProps) {
  const { scheme } = useTheme();
  const inkClassName = scheme === "dark" ? "text-accent" : "text-text-primary";

  return (
    <View className="mt-2 flex-row items-center justify-center gap-1">
      <Text tone="secondary" variant={size === "caption" ? "caption" : "body"}>
        {footer.prompt}
      </Text>
      {onPress === undefined ? (
        <Link asChild href={footer.href}>
          {size === "caption" ? (
            <Pressable className="min-h-touch-target justify-center px-1" role="link">
              <NativeText
                className={`text-caption font-medium tabular-nums underline ${inkClassName}`}
              >
                {footer.linkLabel}
              </NativeText>
            </Pressable>
          ) : (
            <AuthLink label={footer.linkLabel} />
          )}
        </Link>
      ) : (
        <AuthLink label={footer.linkLabel} onPress={onPress} />
      )}
    </View>
  );
}
