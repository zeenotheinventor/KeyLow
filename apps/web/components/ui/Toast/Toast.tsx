"use client";

import { iconStroke } from "@keylow/tokens";
import { useEffect, useRef, useState } from "react";

import type { ToastProps, ToastTone } from "./types";

import { cn } from "@/lib/utils";

const defaultDuration = 5000;

// The tone colours the icon only. The icon is a stroke, not text, so it keeps its colour in light
// mode. Each class is written out whole so Tailwind can see it.
const iconTones = {
  neutral: "stroke-text-secondary",
  success: "stroke-success",
  warning: "stroke-warning",
  danger: "stroke-danger",
} as const satisfies Record<ToastTone, string>;

const placements = {
  absolute: "absolute",
  fixed: "fixed",
} as const;

// On a phone the toast spans the width with a 16 px inset. From 700 px, where the design stops
// calling a screen narrow, it is 360 px wide in the top right corner. It sits at the top, over the page
// and not under it, so a toast never needs to clear a bar.
const frame =
  "top-4 left-4 right-4 z-50 flex min-h-touch-target items-center gap-3 rounded-medium border border-border bg-surface-sheet py-2 pl-4 pr-2 text-text-primary shadow-toast animate-toast-in motion-reduce:animate-none min-[700px]:left-auto min-[700px]:w-[360px]";

// The action is accent in dark. In light that colour is too weak for small text, so it falls back
// to the primary text colour. It is 36 px high, so an invisible pseudo element reaches 4 px above and
// below to a 44 px target, inside the card's 8 px of padding.
const actionButton =
  "relative h-control-sm shrink-0 after:absolute after:inset-x-0 after:-inset-y-1 rounded-small px-3 text-[14px] font-semibold leading-5 text-accent outline-none light-theme:text-text-primary focus-visible:ring-2 focus-visible:ring-focus-ring";

function OpenToast({
  message,
  actionLabel,
  onAction,
  tone = "neutral",
  icon: Icon,
  onClose,
  duration = defaultDuration,
  position = "absolute",
  announce = true,
  focusAction,
}: Omit<ToastProps, "open">) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const onCloseRef = useRef(onClose);
  const actionRef = useRef<HTMLButtonElement>(null);
  // A ref as well as the state: when the toast goes, the cleanup below must know whether focus was on it.
  const hasFocusRef = useRef(false);
  const returnToRef = useRef(focusAction?.returnTo ?? null);
  const canClose = onClose !== undefined;
  const paused = hovered || focused;
  const shouldFocusAction = focusAction !== undefined && actionLabel !== undefined;

  useEffect(() => {
    onCloseRef.current = onClose;
    returnToRef.current = focusAction?.returnTo ?? null;
  });

  useEffect(() => {
    if (shouldFocusAction) {
      actionRef.current?.focus();
    }
  }, [shouldFocusAction]);

  // Focus goes back only if it is still on the toast. A person who has tabbed or clicked away is left there.
  useEffect(
    () => () => {
      const { current: returnTo } = returnToRef;
      const target = typeof returnTo === "function" ? returnTo() : returnTo;
      if (hasFocusRef.current && target?.isConnected === true) {
        target.focus();
      }
    },
    [],
  );

  useEffect(() => {
    if (!canClose || paused) return;
    const timer = setTimeout(() => {
      onCloseRef.current?.();
    }, duration);
    return () => {
      clearTimeout(timer);
    };
  }, [canClose, paused, duration]);

  return (
    <div
      role={announce ? "status" : undefined}
      className={cn(placements[position], frame)}
      // Only a mouse pointer pauses the wait. A touch pointer has no hover, and a tap would
      // otherwise leave the timer paused with nothing to resume it.
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
      onFocus={() => {
        hasFocusRef.current = true;
        setFocused(true);
      }}
      onBlur={() => {
        hasFocusRef.current = false;
        setFocused(false);
      }}
      // A toast over the page heading would hold it for the whole wait, so a press on the card closes it.
      // The action stops its own click, so pressing it runs the action and does not close the toast twice.
      onClick={() => {
        onClose?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          // The toast answers its own Escape, so a dialog behind it stays open.
          event.stopPropagation();
          onClose?.();
        }
      }}
    >
      {Icon !== undefined && (
        <span className="flex">
          <Icon aria-hidden className={cn("size-5", iconTones[tone])} strokeWidth={iconStroke} />
        </span>
      )}
      <span className="min-w-0 flex-1 text-[14px] leading-5">{message}</span>
      {actionLabel !== undefined && (
        <button
          type="button"
          ref={actionRef}
          onClick={(event) => {
            event.stopPropagation();
            onAction?.();
          }}
          className={actionButton}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Confirms a quick action and offers one action, such as Undo. It closes itself after the duration
 * (5000 ms by default), but waits while a mouse is over it or the action holds focus.
 *
 * The action is a shortcut, and the toast sits after the page, so a keyboard user could not reach it
 * within the wait. After an action the person made with the keyboard, a screen passes `focusAction`:
 * focus moves to the action, the wait holds while focus is there, Escape closes the toast, and focus
 * goes back to `returnTo`. Without `focusAction` focus is never moved to the toast.
 */
export function Toast({ open = true, ...rest }: ToastProps) {
  return open ? <OpenToast {...rest} /> : null;
}
