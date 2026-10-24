import { Text as NativeText, View } from "react-native";

import { Icon, PressableSurface, Text } from "../ui";

import type { BodyCompositionPromptProps } from "./types";
import type { IconName, IconTone } from "../ui";

// The classes are written out so Tailwind sees them.
const tileClassName = {
  accent: "bg-accent-muted",
  muted: "bg-surface-raised",
  danger: "bg-danger-muted",
};

type TileLook = { icon: IconName; tone: IconTone; className: string };

const tileLooks: Record<"not-allowed" | "no-readings-yet" | "error", TileLook> = {
  "not-allowed": { icon: "Heart", tone: "accent-ink", className: tileClassName.accent },
  "no-readings-yet": { icon: "Weight", tone: "secondary", className: tileClassName.muted },
  error: { icon: "CircleAlert", tone: "danger", className: tileClassName.danger },
};

// A text button that is 36 points of words in a 44 point target, sitting 4 points left of the words
// above it so its label lines up with them.
function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableSurface
      className="-mx-1 -mb-3 min-h-touch-target justify-center self-start px-1"
      onPress={onPress}
    >
      <Text tone="accent-ink" variant="label-small">
        {label}
      </Text>
    </PressableSurface>
  );
}

/**
 * The prompts of the Body composition section and of the permission flow, in the shapes the boards draw.
 * The default is the stacked compact prompt that `connected · partial` draws: a sentence over a text
 * button, 12 points of padding above and 4 below. `compact` is the section's `partial` row. The full
 * prompts are `not-allowed`, `no-readings-yet` and `error`: a 32 point tile with a glyph beside a title,
 * a text and at most one text button. The error's words are an alert and its button is outside them, so a
 * screen reader that reads the alert as one still reaches the button.
 */
export function BodyCompositionPrompt(props: BodyCompositionPromptProps) {
  if (props.variant === "compact") {
    return (
      <View className="flex-row items-center justify-between gap-3 rounded-large border border-border bg-surface py-1 pl-4 pr-3">
        <NativeText className="shrink text-label-small font-normal tabular-nums text-text-secondary">
          {props.text}
        </NativeText>
        <PressableSurface
          className="min-h-touch-target shrink-0 justify-center px-1"
          onPress={props.onAction}
        >
          <Text tone="accent-ink" variant="label-small">
            {props.action}
          </Text>
        </PressableSurface>
      </View>
    );
  }

  if (
    props.variant === "not-allowed" ||
    props.variant === "no-readings-yet" ||
    props.variant === "error"
  ) {
    const look = tileLooks[props.variant];
    const words = (
      <>
        <Text variant="label-small">{props.title}</Text>
        <NativeText className="text-label-small font-normal tabular-nums text-text-secondary">
          {props.text}
        </NativeText>
      </>
    );

    return (
      <View className="flex-row gap-3 rounded-large border border-border bg-surface p-4">
        <View
          aria-hidden
          className={`h-8 w-8 items-center justify-center rounded-small ${look.className}`}
        >
          <Icon name={look.icon} size={18} tone={look.tone} />
        </View>
        <View className="flex-1 gap-[2px]">
          {props.variant === "error" ? (
            <View accessible aria-live="assertive" className="gap-[2px]" role="alert">
              {words}
            </View>
          ) : (
            words
          )}
          {props.variant === "not-allowed" ? (
            <TextButton label={props.action} onPress={props.onAction} />
          ) : null}
          {props.variant === "error" ? (
            <TextButton label={props.retry} onPress={props.onRetry} />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    // A plain surface and not the kit's Card, whose elevation the board does not draw on this prompt.
    <View className="gap-[2px] rounded-large border border-border bg-surface px-4 pb-1 pt-3">
      <NativeText className="text-label-small font-normal tabular-nums text-text-secondary">
        {props.text}
      </NativeText>
      <PressableSurface
        className="-mx-1 min-h-touch-target justify-center self-start px-1"
        onPress={props.onAction}
      >
        <Text tone="accent-ink" variant="label-small">
          {props.action}
        </Text>
      </PressableSurface>
    </View>
  );
}
