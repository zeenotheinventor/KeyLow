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
// calling a screen narrow, it is 360 px wide in the bottom right corner.
const frame =
  "bottom-4 left-4 right-4 z-30 flex min-h-touch-target items-center gap-3 rounded-medium border border-border bg-surface-sheet py-2 pl-4 pr-2 text-text-primary shadow-toast animate-toast-in motion-reduce:animate-none min-[700px]:left-auto min-[700px]:w-[360px]";

// The action is accent in dark. In light that colour is too weak for small text, so it falls back
// to the primary text colour.
const actionButton =
  "h-control-sm shrink-0 rounded-small px-3 text-[14px] font-semibold leading-5 text-accent outline-none light-theme:text-text-primary focus-visible:ring-2 focus-visible:ring-focus-ring";

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
}: Omit<ToastProps, "open">) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const onCloseRef = useRef(onClose);
  const canClose = onClose !== undefined;
  const paused = hovered || focused;

  useEffect(() => {
    onCloseRef.current = onClose;
  });

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
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
    >
      {Icon !== undefined && (
        <span className="flex">
          <Icon aria-hidden className={cn("size-5", iconTones[tone])} strokeWidth={iconStroke} />
        </span>
      )}
      <span className="min-w-0 flex-1 text-[14px] leading-5">{message}</span>
      {actionLabel !== undefined && (
        <button type="button" onClick={onAction} className={actionButton}>
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
 * The action is a shortcut. A screen must not make it the only way to recover from an action,
 * because a keyboard user may not reach the toast within the wait. Focus is never moved to it.
 */
export function Toast({ open = true, ...rest }: ToastProps) {
  return open ? <OpenToast {...rest} /> : null;
}
