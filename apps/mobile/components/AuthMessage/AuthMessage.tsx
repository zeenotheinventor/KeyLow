import { View } from "react-native";

import { Button, Icon, Text } from "../ui";

import type { AuthMessageProps, AuthMessageTone } from "./types";
import type { IconTone } from "../ui";

// The classes are written out so Tailwind sees them.
const tileClassName: Record<AuthMessageTone, string> = {
  neutral: "bg-surface-raised",
  danger: "bg-danger-muted",
  success: "bg-success-muted",
};

const iconTone: Record<AuthMessageTone, IconTone> = {
  neutral: "secondary",
  danger: "danger",
  success: "success",
};

/**
 * The centred result the password boards draw for the sent, reset link error and saved states: a 56 point
 * tile with a 32 point icon, a heading, a secondary sentence, then full width large buttons and a slot under
 * them. The words are one announcement, an alert for the danger tone and a status for the others, and the
 * buttons sit outside it because a group is read as one and would hide them. The copy is the screen's, from
 * `@keylow/core/copy`.
 */
export function AuthMessage({
  icon,
  tone,
  title,
  body,
  primary,
  secondary,
  children,
}: AuthMessageProps) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-8 pb-[34px]">
      <View
        className={`mb-2 h-[56px] w-[56px] items-center justify-center rounded-medium ${tileClassName[tone]}`}
      >
        <Icon name={icon} size="xl" tone={iconTone[tone]} />
      </View>
      <View
        accessible
        aria-live={tone === "danger" ? "assertive" : "polite"}
        className="items-center gap-2"
        role={tone === "danger" ? "alert" : "status"}
      >
        <Text className="text-center" role="heading" variant="h2">
          {title}
        </Text>
        <Text className="text-center" tone="secondary">
          {body}
        </Text>
      </View>
      <View className="mt-4 gap-2 self-stretch">
        {primary === undefined ? null : (
          <Button fullWidth size="lg" onPress={primary.onPress}>
            {primary.label}
          </Button>
        )}
        {secondary === undefined ? null : (
          <Button fullWidth size="lg" variant="secondary" onPress={secondary.onPress}>
            {secondary.label}
          </Button>
        )}
        {children}
      </View>
    </View>
  );
}
