import { Text as NativeText, View } from "react-native";
import Animated from "react-native-reanimated";

import { useFadeInStyle } from "../../../lib/motion";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";
import { Text } from "../Text";
import { toneClassName } from "../tone";

import type { BannerProps, BannerVariant } from "./types";
import type { IconName, IconTone } from "../Icon";
import type { TextTone } from "../Text";

// The classes are written out so Tailwind sees them. Warning and danger are a border and a muted fill
// with the words in a text colour, because a status colour is not text in light (Q14). The review
// variant's title and action are `warning-ink`, which is warning in dark and the primary text colour in
// light. The quiet variants are the raised surface with a hairline border.

// The boards' `t-bs c-ink` with an underline: lime in dark and the primary text colour in light.
const quietActionClassName =
  "text-body-strong font-semibold tabular-nums underline text-accent-ink";

const variants: Record<
  BannerVariant,
  {
    fillClassName: string;
    borderClassName: string;
    icon: IconName;
    iconTone: IconTone;
    titleTone: TextTone;
    // The quiet variants are the M3 boards' notice: 12 points all round, the sentence in regular body
    // text, and the action in strong body text, underlined, in the accent ink. The others keep the design
    // system card's look, which no board redraws.
    isQuiet: boolean;
    actionClassName: string;
    role: "alert" | "status" | "note";
    // The alert role alone does not announce on mount on Android, so a failure is a live region too.
    liveRegion?: "assertive";
  }
> = {
  review: {
    fillClassName: "bg-warning-muted",
    borderClassName: "border-warning",
    icon: "CircleAlert",
    iconTone: "warning",
    titleTone: "warning-ink",
    isQuiet: false,
    actionClassName: "text-[14px] font-semibold leading-[20px] tabular-nums text-warning-ink",
    role: "note",
  },
  error: {
    fillClassName: "bg-danger-muted",
    borderClassName: "border-danger",
    icon: "CircleAlert",
    iconTone: "danger",
    titleTone: "primary",
    isQuiet: false,
    actionClassName: `text-[14px] font-semibold leading-[20px] tabular-nums ${toneClassName.primary}`,
    role: "alert",
    liveRegion: "assertive",
  },
  offline: {
    fillClassName: "bg-surface-raised",
    borderClassName: "border-border",
    icon: "WifiOff",
    iconTone: "secondary",
    titleTone: "primary",
    isQuiet: true,
    actionClassName: quietActionClassName,
    role: "status",
  },
  info: {
    fillClassName: "bg-surface-raised",
    borderClassName: "border-border",
    icon: "Info",
    iconTone: "secondary",
    titleTone: "primary",
    isQuiet: true,
    actionClassName: quietActionClassName,
    role: "status",
  },
};

/**
 * A notice in the flow of a view: an icon, a title, a sentence and one optional action, and a slot for
 * something drawn under the words, such as a progress bar. It fades in, in place of the design's cut-in
 * from the side, which waits for a motion review on a device. The copy is the screen's, from
 * `@keylow/core/copy`.
 */
export function Banner({
  variant = "info",
  title,
  body,
  icon,
  hasIcon = true,
  size = "default",
  sentence,
  action,
  announce,
  children,
}: BannerProps) {
  const animatedStyle = useFadeInStyle();
  const look = variants[variant];
  const isCompact = size === "compact";
  // The compact size is the trend explainer's: no border, 12 points all round, and the title in the 14 over 20
  // label style. The default is the design system card's.
  const boxClassName = isCompact
    ? `p-3 ${look.fillClassName}`
    : `border ${look.isQuiet ? "p-3" : "px-4 py-3"} ${look.borderClassName} ${look.fillClassName}`;
  // Only the review notice can be raised: the quiet ones are never an alert, and the error already is.
  const isRaised = announce === true && variant === "review";

  // A class and an animated style cannot share an element, so the fade sits on a wrapper with no class.
  return (
    <Animated.View style={animatedStyle} testID="banner-fade">
      <View
        className={`flex-row items-start gap-3 rounded-medium ${boxClassName}`}
        testID="banner-box"
      >
        {hasIcon ? (
          <View className="pt-[2px]">
            <Icon name={icon ?? look.icon} tone={look.iconTone} />
          </View>
        ) : null}
        <View className="min-w-0 flex-1 gap-[2px]">
          {/* The words are announced as one group, and the action stays outside it so it can be reached. */}
          <View
            accessible
            aria-live={isRaised ? "assertive" : look.liveRegion}
            className="gap-[2px]"
            role={isRaised ? "alert" : look.role}
          >
            {/* The title is strong, as the design system card draws it. Only a sentence the screen asks for is regular. */}
            <Text
              tone={isCompact ? "primary" : look.titleTone}
              variant={
                isCompact
                  ? "label-small"
                  : sentence === true && body === undefined
                    ? "body"
                    : "body-strong"
              }
            >
              {title}
            </Text>
            {body === undefined ? null : (
              <Text tone="secondary" variant={look.isQuiet ? "body" : "caption"}>
                {body}
              </Text>
            )}
          </View>
          {children == null || children === false ? null : (
            // The slot sits outside the announced words too, so the words are read alone. The 6 points
            // with the column's 2 give the 8 the boards leave between the words and a bar.
            <View className="pt-[6px]">{children}</View>
          )}
          {action === undefined ? null : (
            // The action reaches the 44 point touch target by growing past its text, and the negative
            // margins give back the room it takes, as the boards draw it. The quiet action's 24 point line
            // leaves 10 points above and below, so it gives both back and sits 2 under the sentence.
            <PressableSurface
              className={`-mx-2 -mb-[10px] min-h-touch-target justify-center self-start px-2 ${look.isQuiet ? "-mt-[10px]" : ""}`}
              label={action.label}
              onPress={action.onPress}
            >
              {/* The review and error action is set at 14 over 20, which is between the type scale's sizes, so it is not a Text variant. */}
              <NativeText className={look.actionClassName}>{action.label}</NativeText>
            </PressableSurface>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
