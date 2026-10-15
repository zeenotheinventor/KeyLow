import { spacing, tabBarHeight } from "@keylow/tokens";
import { vars } from "nativewind";
import { useEffect, useRef, useState } from "react";
import { Text as NativeText, View } from "react-native";
import Animated from "react-native-reanimated";

import { useFadeInStyle } from "../../../lib/motion";
import { useTheme } from "../../../lib/theme";
import { Icon } from "../Icon";
import { PressableSurface } from "../PressableSurface";

import type { ToastProps, ToastTone } from "./types";
import type { IconProps } from "../Icon";

const defaultDuration = 5000;

// The design's `--space-3`, the gap between the toast and the tab bar.
const gapAboveTabBar = Number.parseInt(spacing["3"], 10);

// The tone colours the icon only, and the words stay in the primary text colour.
const iconTones = {
  neutral: "secondary",
  success: "success",
  warning: "warning",
  danger: "danger",
} as const satisfies Record<ToastTone, IconProps["tone"]>;

// The classes are written out so Tailwind sees them. The bottom edge is a runtime value (the safe area
// under the tab bar), so it goes through a variable, as the tab bar's own inset does.
const placementClassName = "absolute left-4 right-4 bottom-[var(--toast-bottom)] z-30";
const boxClassName =
  "min-h-touch-target flex-row items-center gap-3 rounded-medium border border-border bg-surface-sheet py-2 pl-4 pr-2 elevation-toast";

/**
 * Confirms a quick action and offers one action, such as Undo. It closes itself after the duration
 * (5000 ms by default) with or without the action, but waits while a finger is on it. It fades in, in
 * place of the design's cut in from the edge, which waits for a motion review on a device.
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
  icon,
  onClose,
  duration = defaultDuration,
  bottomInset = 0,
  bottomClearance = 0,
}: Omit<ToastProps, "open">) {
  const { scheme } = useTheme();
  const animatedStyle = useFadeInStyle();
  // The action is accent in dark. In light that colour is too weak for small text, so it falls back to the
  // primary text colour. This is `--accent-ink`, which lands with KEY-192: swap in `text-accent-ink` then.
  const actionClassName = scheme === "dark" ? "text-accent" : "text-text-primary";
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
    }, duration);
    return () => {
      clearTimeout(timer);
    };
  }, [canClose, isTouched, duration]);

  // A class and an animated style cannot share an element, so the fade sits on a wrapper with no class,
  // between the placement and the box.
  return (
    <View
      className={placementClassName}
      style={vars({
        "--toast-bottom": tabBarHeight + bottomInset + gapAboveTabBar + bottomClearance,
      })}
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
        <View className={boxClassName}>
          {/* The words are one group with the status role, and the action stays outside it so it can be reached. */}
          <View accessible className="min-w-0 flex-1 flex-row items-center gap-3" role="status">
            {icon === undefined ? null : <Icon name={icon} tone={iconTones[tone]} />}
            {/* The design sets this at 14 over 20, which is between the type scale's sizes, so it is not a Text variant. */}
            <NativeText className="min-w-0 flex-1 text-[14px] font-normal leading-[20px] tabular-nums text-text-primary">
              {message}
            </NativeText>
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
        </View>
      </Animated.View>
    </View>
  );
}
