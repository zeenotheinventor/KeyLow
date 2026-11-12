import { iconStroke } from "@keylow/tokens";
import { CircleAlert, Info } from "lucide-react";
import Link from "next/link";

import type { BannerAction, BannerProps, BannerTone } from "./types";

import { cn } from "@/lib/utils";

// A notice in the flow of the page. Dark can colour small text, but in light only a dot, border or
// muted fill carries the colour, so the warning ink falls back to the primary text colour there.
// Info is the quiet notice the boards draw: 12 all round, the sentence in body size and the action
// in the accent ink, underlined, under the words. Review and error keep their older look.
// The compact size is the trend explainer's: 12 all round whatever the tone, and its title in the label
// style in the primary ink, as the board draws the settling banner.
// Each class is written out whole so Tailwind can see it.
const toneStyles = {
  info: {
    frame: "border-border bg-surface-raised p-3",
    compactFrame: "border-border bg-surface-raised p-3",
    icon: "text-text-secondary",
    ink: "text-text-primary",
    sentence: "text-body text-text-secondary",
    trailingActionText: "text-body-strong text-accent-ink underline",
    belowActionText: "text-body-strong text-accent-ink underline after:-inset-y-2.5",
    defaultActionPlacement: "below",
    defaultRole: "status",
    defaultIcon: Info,
  },
  review: {
    frame: "border-warning bg-warning-muted px-4 py-3",
    compactFrame: "border-warning bg-warning-muted p-3",
    icon: "text-warning",
    ink: "text-warning light-theme:text-text-primary",
    sentence: "text-caption text-text-secondary",
    trailingActionText:
      "text-[14px] font-semibold leading-5 text-warning light-theme:text-text-primary",
    belowActionText:
      "text-[14px] font-semibold leading-5 text-text-primary underline after:-inset-y-3",
    defaultActionPlacement: "trailing",
    defaultRole: "note",
    defaultIcon: CircleAlert,
  },
  error: {
    frame: "border-danger bg-danger-muted px-4 py-3",
    compactFrame: "border-danger bg-danger-muted p-3",
    icon: "text-danger",
    ink: "text-text-primary",
    sentence: "text-caption text-text-secondary",
    trailingActionText: "text-[14px] font-semibold leading-5 text-text-primary",
    belowActionText:
      "text-[14px] font-semibold leading-5 text-text-primary underline after:-inset-y-3",
    defaultActionPlacement: "trailing",
    defaultRole: "alert",
    defaultIcon: CircleAlert,
  },
} as const satisfies Record<BannerTone, object>;

// An action is text and is shorter than 44 px, so an invisible pseudo element reaches past it to a 44 px
// target: 8 px to each side, as a word such as "Retry" is under 44 px wide, and the vertical reach that
// the tone's below-the-words text sets, from its line height. The trailing action is 36 px high and
// reaches 4 px above and below.
const actionFrame =
  "relative rounded-small outline-none after:absolute after:-inset-x-2 focus-visible:ring-2 focus-visible:ring-focus-ring";

function ActionControl({ action, className }: { action: BannerAction; className: string }) {
  if (action.href !== undefined) {
    return (
      <Link
        href={action.href}
        className={className}
        {...(action.newTab === true ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-disabled={action.disabled === true ? true : undefined}
      onClick={action.disabled === true ? undefined : action.onClick}
      className={cn(className, action.disabled === true && "opacity-40")}
    >
      {action.label}
    </button>
  );
}

/** A persistent notice: a review prompt for a food with values missing, a status, or an error that stays on the page. */
export function Banner({
  tone = "info",
  title,
  sentence = false,
  hasIcon = true,
  size = "default",
  children,
  icon,
  role,
  action,
  actionPlacement,
  className,
}: BannerProps) {
  const style = toneStyles[tone];
  const Icon = icon ?? style.defaultIcon;
  const placement = actionPlacement ?? style.defaultActionPlacement;
  const isCompact = size === "compact";

  return (
    <div
      role={role ?? style.defaultRole}
      className={cn(
        "flex items-start gap-3 rounded-medium border text-text-primary",
        isCompact ? style.compactFrame : style.frame,
        className,
      )}
    >
      {hasIcon && (
        <span className={cn("flex pt-0.5", style.icon)}>
          <Icon aria-hidden className="size-5" strokeWidth={iconStroke} />
        </span>
      )}
      <span
        className={cn("flex min-w-0 flex-1 flex-col", title === undefined ? "gap-1" : "gap-0.5")}
      >
        {title === undefined ? (
          <span className={sentence ? style.sentence : "text-body"}>{children}</span>
        ) : (
          <>
            <span
              className={
                isCompact ? "text-label-small text-text-primary" : cn("text-body-strong", style.ink)
              }
            >
              {title}
            </span>
            <span className={style.sentence}>{children}</span>
          </>
        )}
        {action !== undefined && placement === "below" && (
          <ActionControl
            action={action}
            className={cn(actionFrame, "self-start", style.belowActionText)}
          />
        )}
      </span>
      {action !== undefined && placement === "trailing" && (
        <ActionControl
          action={action}
          className={cn(
            actionFrame,
            "flex min-h-control-sm shrink-0 items-center after:-inset-y-1",
            style.trailingActionText,
          )}
        />
      )}
    </div>
  );
}
