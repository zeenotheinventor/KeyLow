import { TOAST_DISMISS_LABEL } from "@keylow/core/copy";
import { spacing, tabBarHeight } from "@keylow/tokens";
import { vars } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, Text as NativeText, View } from "react-native";
import Animated from "react-native-reanimated";

import { useFadeInStyle } from "../../../lib/motion";
import { useTheme } from "../../../lib/theme";
import { Badge } from "../Badge";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";

import type { ToastProps, ToastTone, ToastVariant } from "./types";
import type { IconProps } from "../Icon";
import type { GestureResponderHandlers } from "react-native";

const defaultDuration = 5000;
// Board 3: the unlock toast shows for 4 seconds.
const achievementDuration = 4000;
// How far a downward drag must go to take the achievement toast away.
const swipeAwayDistance = 24;
// The space board 3 leaves above the tab bar.
const gapAboveTabBar = 17;

const dismissActionName = "dismiss";
const dismissActions = [{ name: dismissActionName, label: TOAST_DISMISS_LABEL }];

// The design's `--space-3`, the gap between the toast and the status bar's safe area.
const gapBelowStatusBar = Number.parseInt(spacing["3"], 10);

// The tone colours the icon only, and the words stay in the primary text colour.
const iconTones = {
  neutral: "secondary",
  success: "success",
  warning: "warning",
  danger: "danger",
  accent: "accent",
} as const satisfies Record<ToastTone, IconProps["tone"]>;

// The classes are written out so Tailwind sees them. The top edge is a runtime value (the safe area under the
// status bar), so it goes through a variable, as the tab bar's own inset does.
const placementClassName = "absolute left-4 right-4 top-[var(--toast-top)] z-30";
const boxClassName =
  "min-h-touch-target flex-row items-center gap-3 rounded-medium border py-2 pl-4 pr-2 elevation-toast";
const achievementPlacementClassName = "absolute left-3 right-3 bottom-[var(--toast-bottom)] z-30";
const achievementBoxClassName =
  "flex-row gap-3 rounded-large border px-[14px] py-3 elevation-toast";

// What changes with the variant: the card, the words and the action. The filled card is the success colour
// with the ink for it on top, in place of the lime action, which would not read on green.
const variantClassNames = {
  default: {
    card: "border-border bg-surface-sheet",
    words: "text-text-primary",
  },
  "success-filled": {
    card: "border-success bg-success",
    words: "text-text-on-success",
  },
  achievement: {
    card: "border-border-strong bg-surface-sheet",
    words: "text-text-primary",
  },
} as const satisfies Record<ToastVariant, { card: string; words: string }>;

/**
 * Confirms a quick action and offers one action, such as Undo. It closes itself after the duration
 * (5000 ms by default) with or without the action, but waits while a finger is on it. It sits at the top of the
 * screen, under the status bar, above every screen and its header. It fades in, in place of the design's cut in
 * from the edge, which waits for a motion review on a device.
 *
 * A tap on the card outside the action closes it at once, and a screen reader can run a "dismiss" action on the
 * words, so a toast over a header never holds its back button.
 *
 * The action is a shortcut. A screen must not make it the only way to recover from an action, because
 * the toast is gone after the wait. Focus is never moved to it.
 */
export function Toast({ open = true, ...rest }: ToastProps) {
  return open ? <OpenToast {...rest} /> : null;
}

function OpenToast({
  message,
  actionLabel,
  onAction,
  tone = "neutral",
  variant = "default",
  icon,
  isIconFilled = false,
  topOffset = gapBelowStatusBar,
  onClose,
  duration,
  topInset = 0,
  bottomInset = 0,
  description,
  medal,
  chips = [],
}: Omit<ToastProps, "open">) {
  const { scheme } = useTheme();
  const animatedStyle = useFadeInStyle();
  // The action is accent in dark. In light that colour is too weak for small text, so it falls back to the
  // primary text colour. This is `--accent-ink`, which lands with KEY-192: swap in `text-accent-ink` then.
  const defaultActionClassName = scheme === "dark" ? "text-accent" : "text-text-primary";
  const isFilled = variant === "success-filled";
  const isAchievement = variant === "achievement";
  const waitDuration = duration ?? (isAchievement ? achievementDuration : defaultDuration);
  const { card: cardClassName, words: wordsClassName } = variantClassNames[variant];
  const actionClassName = isFilled ? wordsClassName : defaultActionClassName;
  const [isTouched, setIsTouched] = useState(false);
  const onCloseRef = useRef(onClose);
  const canClose = onClose !== undefined;

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // A touch holds the wait. Lifting the finger gives the whole wait again, which is what a press on the
  // action would leave, so a user who read the toast with a thumb on it still has the time to act.
  useEffect(() => {
    if (!canClose || isTouched) {
      return;
    }
    const timer = setTimeout(() => {
      onCloseRef.current?.();
    }, waitDuration);
    return () => {
      clearTimeout(timer);
    };
  }, [canClose, isTouched, waitDuration]);

  // A downward drag past a short distance takes the achievement toast away, as board 3 says. A tap and a
  // press on the action are left to their own handlers, because the responder only claims a mostly vertical move.
  // Its handlers are only given to the achievement toast.
  const [swipeHandlers, setSwipeHandlers] = useState<GestureResponderHandlers>({});
  useEffect(() => {
    setSwipeHandlers(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, { dx, dy }) => dy > 8 && Math.abs(dy) > Math.abs(dx),
        onPanResponderRelease: (_event, { dy }) => {
          if (dy > swipeAwayDistance) {
            onCloseRef.current?.();
          }
        },
      }).panHandlers,
    );
  }, []);

  // A class and an animated style cannot share an element, so the fade sits on a wrapper with no class,
  // between the placement and the box.
  return (
    <View
      className={isAchievement ? achievementPlacementClassName : placementClassName}
      style={vars(
        isAchievement
          ? { "--toast-bottom": bottomInset + tabBarHeight + gapAboveTabBar }
          : { "--toast-top": topInset + topOffset },
      )}
      {...(isAchievement ? swipeHandlers : {})}
      onTouchCancel={() => {
        setIsTouched(false);
      }}
      onTouchEnd={() => {
        setIsTouched(false);
      }}
      onTouchStart={() => {
        setIsTouched(true);
      }}
      // The placement is a layout view with no role of its own, because the words and the action are inside it.
      testID="toast"
    >
      {/* The fade wrapper has no role either: it carries the animated opacity and nothing else. */}
      <Animated.View style={animatedStyle} testID="toast-fade">
        {/* A tap on the card outside the action takes the toast down, so it never holds a header's back button
            for the wait. The card is not an element of its own for a screen reader, which gets the dismiss
            action on the words instead, and the action's own press is never this one. */}
        <Pressable
          accessible={false}
          className={
            isAchievement
              ? `${achievementBoxClassName} ${cardClassName} ${chips.length > 0 ? "items-start" : "items-center"}`
              : `${boxClassName} ${cardClassName}`
          }
          testID="toast-box"
          onPress={() => {
            onClose?.();
          }}
        >
          {/* The words are one group with the status role, and the action stays outside it so it can be reached. */}
          <View
            accessible
            accessibilityActions={canClose ? dismissActions : undefined}
            className={`min-w-0 flex-1 flex-row gap-3 ${isAchievement && chips.length > 0 ? "items-start" : "items-center"}`}
            role="status"
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === dismissActionName) {
                onClose?.();
              }
            }}
          >
            {medal}
            {icon === undefined ? null : (
              <Icon
                isFilled={isIconFilled}
                name={icon}
                tone={isFilled ? "text-on-success" : iconTones[tone]}
              />
            )}
            {isAchievement ? (
              <View className="min-w-0 flex-1">
                {/* The board sets the title at 15 over 20 and the line under it at 13 over 18, between the type scale's sizes. */}
                <NativeText
                  className={`text-[15px] font-semibold leading-[20px] tabular-nums ${wordsClassName}`}
                >
                  {message}
                </NativeText>
                {description === undefined ? null : (
                  <NativeText className="text-[13px] font-normal leading-[18px] tabular-nums text-text-secondary">
                    {description}
                  </NativeText>
                )}
                {chips.length === 0 ? null : (
                  <View className="mt-1 flex-row flex-wrap gap-[6px]">
                    {chips.map(({ label, tone: chipTone }) => (
                      <Badge key={label} tone={chipTone}>
                        {label}
                      </Badge>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              /* The design sets this at 14 over 20, which is between the type scale's sizes, so it is not a Text variant. */
              <NativeText
                className={`min-w-0 flex-1 text-[14px] font-normal leading-[20px] tabular-nums ${wordsClassName}`}
              >
                {message}
              </NativeText>
            )}
          </View>
          {actionLabel === undefined ? null : (
            <PressableSurface
              className="h-control-sm justify-center rounded-small px-3"
              label={actionLabel}
              onPress={onAction}
            >
              <NativeText
                className={`text-[14px] font-semibold leading-[20px] tabular-nums ${actionClassName}`}
              >
                {actionLabel}
              </NativeText>
            </PressableSurface>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
