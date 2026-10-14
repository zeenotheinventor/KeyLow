import { iconStroke } from "@keylow/tokens";
import { CircleAlert, Info } from "lucide-react";
import Link from "next/link";

import type { BannerAction, BannerProps, BannerTone } from "./types";

import { cn } from "@/lib/utils";

// A notice in the flow of the page. Dark can colour small text, but in light only a dot, border or
// muted fill carries the colour, so the warning ink falls back to the primary text colour there.
// Each class is written out whole so Tailwind can see it.
const toneStyles = {
  info: {
    frame: "border-border bg-surface-raised",
    icon: "text-text-secondary",
    ink: "text-text-primary",
    defaultRole: "status",
    defaultIcon: Info,
  },
  review: {
    frame: "border-warning bg-warning-muted",
    icon: "text-warning",
    ink: "text-warning [[data-theme=light]_&]:text-text-primary",
    defaultRole: "note",
    defaultIcon: CircleAlert,
  },
  error: {
    frame: "border-danger bg-danger-muted",
    icon: "text-danger",
    ink: "text-text-primary",
    defaultRole: "alert",
    defaultIcon: CircleAlert,
  },
} as const satisfies Record<BannerTone, object>;

const actionText =
  "rounded-small text-[14px] font-semibold leading-5 outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

function ActionControl({ action, className }: { action: BannerAction; className: string }) {
  if (action.href !== undefined) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

/** A persistent notice: a review prompt for a food with values missing, a status, or an error that stays on the page. */
export function Banner({
  tone = "info",
  title,
  children,
  icon,
  role,
  action,
  actionPlacement = "trailing",
  className,
}: BannerProps) {
  const style = toneStyles[tone];
  const Icon = icon ?? style.defaultIcon;

  return (
    <div
      role={role ?? style.defaultRole}
      className={cn(
        "flex items-start gap-3 rounded-medium border px-4 py-3 text-text-primary",
        style.frame,
        className,
      )}
    >
      <span className={cn("flex pt-0.5", style.icon)}>
        <Icon aria-hidden className="size-5" strokeWidth={iconStroke} />
      </span>
      <span
        className={cn("flex min-w-0 flex-1 flex-col", title === undefined ? "gap-1" : "gap-0.5")}
      >
        {title === undefined ? (
          <span className="text-body">{children}</span>
        ) : (
          <>
            <span className={cn("text-body-strong", style.ink)}>{title}</span>
            <span className="text-caption text-text-secondary">{children}</span>
          </>
        )}
        {action !== undefined && actionPlacement === "below" && (
          <ActionControl
            action={action}
            className={cn(actionText, "self-start text-text-primary underline")}
          />
        )}
      </span>
      {action !== undefined && actionPlacement === "trailing" && (
        <ActionControl
          action={action}
          className={cn(actionText, "flex min-h-[36px] shrink-0 items-center", style.ink)}
        />
      )}
    </div>
  );
}
