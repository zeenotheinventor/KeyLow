import { iconStroke } from "@keylow/tokens";
import Link from "next/link";

import type { EmptyStateAction, EmptyStateProps, EmptyStateSize } from "./types";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const sizeClasses = {
  list: { frame: "py-10", body: "" },
  section: { frame: "py-12", body: "" },
  page: { frame: "py-14", body: "" },
  placeholder: { frame: "py-16", body: "max-w-[360px]" },
} as const satisfies Record<EmptyStateSize, { frame: string; body: string }>;

function ActionButton({ action }: { action: EmptyStateAction }) {
  const Icon = action.icon;
  const variant = action.variant ?? "secondary";
  const content = (
    <>
      {Icon !== undefined && <Icon aria-hidden strokeWidth={iconStroke} />}
      {action.label}
    </>
  );

  if (action.href !== undefined) {
    return (
      <Button asChild variant={variant} className="mt-3">
        <Link href={action.href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button variant={variant} className="mt-3" onClick={action.onClick}>
      {content}
    </Button>
  );
}

/** Fills a view or a card when there is nothing to show: a muted icon, a short title, one line of body and at most one action. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  headingLevel = 2,
  action,
  tone = "neutral",
  role,
  size = "list",
  className,
}: EmptyStateProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center gap-2 rounded-large border border-border bg-surface px-6 text-center text-text-primary",
        sizeClasses[size].frame,
        className,
      )}
    >
      <span
        className={cn(
          "mb-2 flex size-14 items-center justify-center rounded-medium",
          tone === "danger" ? "bg-danger-muted text-danger" : "bg-surface-raised text-text-muted",
        )}
      >
        <Icon aria-hidden className="size-8" strokeWidth={iconStroke} />
      </span>
      <Heading className="text-h2">{title}</Heading>
      {body !== undefined && (
        <p className={cn("text-body text-text-secondary", sizeClasses[size].body)}>{body}</p>
      )}
      {action !== undefined && <ActionButton action={action} />}
    </div>
  );
}
