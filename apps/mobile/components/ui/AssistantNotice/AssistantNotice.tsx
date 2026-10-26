import { View } from "react-native";

import { Button } from "../Button";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";

import type { AssistantNoticeButtonKind, AssistantNoticeProps, AssistantNoticeTone } from "./types";
import type { ButtonVariant } from "../Button";
import type { IconTone } from "../Icon";

// The classes are written out so Tailwind sees them. The failed turn is the one notice with a coloured
// border. The accent notice, the consent card, is set apart by its tile alone.
const tones: Record<
  AssistantNoticeTone,
  {
    boxClassName: string;
    tileClassName: string;
    iconTone: IconTone;
    role: "alert" | "status";
  }
> = {
  neutral: {
    boxClassName: "border-border",
    tileClassName: "bg-surface-raised",
    iconTone: "secondary",
    role: "status",
  },
  danger: {
    boxClassName: "border-danger",
    tileClassName: "bg-danger-muted",
    iconTone: "danger",
    role: "alert",
  },
  accent: {
    boxClassName: "border-border",
    tileClassName: "bg-accent-muted",
    iconTone: "accent-ink",
    role: "status",
  },
};

const buttonVariants: Record<AssistantNoticeButtonKind, ButtonVariant> = {
  primary: "primary",
  secondary: "secondary",
  danger: "destructive",
  ghost: "ghost",
};

/**
 * A message from the assistant's own plumbing, in the thread: a limit reached, the assistant switched
 * off, a failed turn or the consent card. An icon tile and a title, the paragraphs, an optional link, the
 * small print, and full-width buttons. Every word is the caller's. The title and the paragraphs are
 * announced as one group (an alert for a failure, a status otherwise) and the link and the buttons stay
 * outside it, where a screen reader can reach them.
 */
export function AssistantNotice({
  icon,
  tone = "neutral",
  title,
  paragraphs,
  link,
  smallPrint,
  buttons = [],
}: AssistantNoticeProps) {
  const look = tones[tone];

  return (
    // The box is Card's look with a border colour Card has no prop for, and with none of its elevation,
    // which the boards do not draw on a notice.
    <View
      className={`gap-3 rounded-large border bg-surface p-4 ${look.boxClassName}`}
      testID="assistant-notice-box"
    >
      <View
        accessible
        aria-live={tone === "danger" ? "assertive" : undefined}
        className="gap-3"
        role={look.role}
      >
        <View className="flex-row items-center gap-3">
          <View
            className={`h-9 w-9 shrink-0 items-center justify-center rounded-small ${look.tileClassName}`}
            testID="assistant-notice-tile"
          >
            <Icon name={icon} tone={look.iconTone} />
          </View>
          <Text className="min-w-0 flex-1" variant="body-strong">
            {title}
          </Text>
        </View>
        {paragraphs.map((paragraph, index) => (
          <Text key={`${index}-${paragraph}`} tone="secondary">
            {paragraph}
          </Text>
        ))}
      </View>
      {link === undefined ? null : (
        // The link reaches the 44 point touch target by growing past its text, and the negative margins
        // give back the room it takes, as the banner's action does.
        <PressableSurface
          className="-mx-2 -my-[10px] min-h-touch-target justify-center self-start px-2"
          label={link.label}
          onPress={link.onPress}
        >
          <Text className="underline" tone="accent-ink" variant="body-strong">
            {link.label}
          </Text>
        </PressableSurface>
      )}
      {smallPrint === undefined ? null : (
        <Text tone="muted" variant="caption">
          {smallPrint}
        </Text>
      )}
      {buttons.length === 0 ? null : (
        <View className="gap-2">
          {buttons.map((button) => (
            <Button
              key={button.label}
              fullWidth
              variant={buttonVariants[button.kind]}
              onPress={button.onPress}
            >
              {button.label}
            </Button>
          ))}
        </View>
      )}
    </View>
  );
}
