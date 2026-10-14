import { iconStroke } from "@keylow/tokens";
import { LoaderCircle } from "lucide-react";

import type { InlineStatusProps } from "./types";

import { cn } from "@/lib/utils";

const sizeClasses = {
  caption: "text-caption",
  small: "text-[14px] leading-5",
} as const satisfies Record<NonNullable<InlineStatusProps["size"]>, string>;

/** A line that says what is happening, with a spinner. The spinner pulses instead of turning under prefers-reduced-motion. */
export function InlineStatus({ children, size = "caption" }: InlineStatusProps) {
  return (
    <p
      role="status"
      className={cn("flex items-center gap-2 text-text-secondary", sizeClasses[size])}
    >
      <LoaderCircle
        aria-hidden
        className="size-4 shrink-0 animate-spin text-accent motion-reduce:animate-pulse [[data-theme=light]_&]:text-text-primary"
        strokeWidth={iconStroke}
      />
      {children}
    </p>
  );
}
