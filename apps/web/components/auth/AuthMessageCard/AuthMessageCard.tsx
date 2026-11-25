import { iconStroke } from "@keylow/tokens";
import Link from "next/link";
import { useId } from "react";

import type { AuthMessageCardProps, AuthMessageTone } from "./types";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// Each class is written out whole so Tailwind can see it.
const tileClasses = {
  neutral: "bg-surface-raised text-text-secondary",
  danger: "bg-danger-muted text-danger",
  success: "bg-success-muted text-success",
} as const satisfies Record<AuthMessageTone, string>;

/** The centred content of an auth card that says one thing, such as the reset link was sent or is not valid. */
export function AuthMessageCard({
  tone,
  icon: Icon,
  title,
  body,
  primaryAction,
  secondaryAction,
  footer,
  titleRef,
}: AuthMessageCardProps) {
  const titleId = useId();
  const hasActions =
    primaryAction !== undefined || secondaryAction !== undefined || footer !== undefined;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {/* Only the message is the live region, so the buttons and the footer's countdown are not announced. */}
      <div
        role={tone === "danger" ? "alert" : "status"}
        aria-labelledby={titleId}
        className="flex flex-col items-center gap-2 self-stretch"
      >
        <span
          className={cn(
            "mb-2 flex size-14 items-center justify-center rounded-medium",
            tileClasses[tone],
          )}
        >
          <Icon aria-hidden strokeWidth={iconStroke} className="size-8" />
        </span>
        <h1 ref={titleRef} id={titleId} tabIndex={-1} className="text-h2 outline-none">
          {title}
        </h1>
        <p className="self-stretch text-body text-text-secondary [overflow-wrap:anywhere]">
          {body}
        </p>
      </div>
      {hasActions && (
        <div className="mt-3 flex flex-col gap-2 self-stretch">
          {primaryAction !== undefined && (
            <Button asChild>
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
          )}
          {secondaryAction !== undefined && (
            <Button asChild variant="secondary">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}
