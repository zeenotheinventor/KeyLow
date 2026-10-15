import { Link } from "expo-router";
import { Pressable, Text as NativeText, View } from "react-native";

import { useTheme } from "../../../lib/theme";
import { Text } from "../../ui";

import type { AuthFooterProps } from "./types";

/**
 * The line under the buttons that links to the other of the two screens. The link is the pressable's,
 * because a class on the link's own text is not read on a device. The caption size draws the link in the
 * accent ink as the checkbox links are: lime in dark and the primary text colour in light.
 */
export function AuthFooter({ footer, size = "body" }: AuthFooterProps) {
  const { scheme } = useTheme();
  const inkClassName = scheme === "dark" ? "text-accent" : "text-text-primary";

  return (
    <View className="mt-2 flex-row items-center justify-center gap-1">
      <Text tone="secondary" variant={size === "caption" ? "caption" : "body"}>
        {footer.prompt}
      </Text>
      <Link asChild href={footer.href}>
        <Pressable className="min-h-touch-target justify-center px-1" role="link">
          {size === "caption" ? (
            <NativeText
              className={`text-caption font-medium tabular-nums underline ${inkClassName}`}
            >
              {footer.linkLabel}
            </NativeText>
          ) : (
            <Text className="underline" variant="body-strong">
              {footer.linkLabel}
            </Text>
          )}
        </Pressable>
      </Link>
    </View>
  );
}
