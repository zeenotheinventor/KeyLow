import { iconStroke } from "@keylow/tokens";
import { Check } from "lucide-react";

import { AssistantLinkRow } from "./AssistantLinkRow";

import type {
  AssistantActionCardIconTone,
  AssistantActionCardProps,
  AssistantActionCardRow,
  AssistantActionCardUndo,
} from "./types";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

// Each class is written out whole so Tailwind can see it.
const iconToneClasses = {
  success: "stroke-success",
  secondary: "stroke-text-secondary",
  muted: "stroke-text-muted",
} as const satisfies Record<AssistantActionCardIconTone, string>;

/**
 * What the assistant did, as a card in the thread: an icon tile, a title and its Undo, then the entries it
 * made, a total, a note and a link to what it made. Every word and every amount is the caller's and is drawn
 * exactly as given. The Undo is the diary toast's action in the accent ink, 36 px high. The card stays in
 * the thread after an Undo, with the title muted and no action, so the history reads true.
 */
export function AssistantActionCard({
  icon: Icon,
  iconTone = "success",
  title,
  subtitle,
  rows = [],
  total,
  note,
  link,
  undo,
}: AssistantActionCardProps) {
  return (
    // The board draws the card flat, as the notice is, so this is Card's surface without its shadow.
    <div
      role="group"
      aria-label={title}
      className="overflow-hidden rounded-large border border-border bg-surface text-text-primary"
    >
      <div className="flex items-center gap-3 p-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-small bg-surface-raised"
        >
          <Icon className={cn("size-5", iconToneClasses[iconTone])} strokeWidth={iconStroke} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span
            className={cn(
              "text-body-strong",
              undo.state === "done" ? "text-text-secondary" : "text-text-primary",
            )}
          >
            {title}
          </span>
          {subtitle === undefined ? null : (
            <span className="text-caption text-text-muted">{subtitle}</span>
          )}
        </div>
        <UndoAction undo={undo} />
      </div>
      {rows.map((row, index) => (
        <Row key={`${index}-${row.name}`} row={row} />
      ))}
      {total === undefined ? null : (
        <div className="border-t border-border bg-surface-raised px-3 py-[10px] text-caption tabular-nums text-text-secondary">
          {total}
        </div>
      )}
      {note === undefined ? null : (
        <div className="border-t border-border px-3 py-[10px] text-caption text-text-secondary">
          {note}
        </div>
      )}
      {link === undefined ? null : <AssistantLinkRow label={link.label} onPress={link.onPress} />}
    </div>
  );
}

function UndoAction({ undo }: { undo: AssistantActionCardUndo }) {
  if (undo.state === "done") {
    return null;
  }
  if (undo.state === "unavailable") {
    return <span className="shrink-0 px-2 text-caption text-text-muted">{undo.label}</span>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={undo.state === "busy"}
      loadingLabel={undo.label}
      onClick={undo.onPress}
      className="rounded-small text-label-small text-accent-ink"
    >
      {undo.label}
    </Button>
  );
}

function Row({ row }: { row: AssistantActionCardRow }) {
  const isUnresolved = row.match === "unresolved";

  return (
    <div className="flex items-center gap-3 border-t border-border px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-body">{row.name}</div>
        <div className="flex flex-wrap items-center gap-[6px]">
          <span
            className={cn(
              "text-caption tabular-nums",
              isUnresolved ? "text-warning-ink" : "text-text-muted",
            )}
          >
            {row.detail}
          </span>
          {row.estimateLabel === undefined ? null : <Badge outlined>{row.estimateLabel}</Badge>}
        </div>
      </div>
      {row.value === undefined ? null : (
        <span className="shrink-0 text-body tabular-nums text-text-secondary">{row.value}</span>
      )}
      {row.match === "matched" ? (
        <Check
          role="img"
          aria-label={row.matchLabel}
          className="size-4 shrink-0 stroke-success"
          strokeWidth={iconStroke}
        />
      ) : null}
      {isUnresolved ? <Badge tone="warning">{row.matchLabel}</Badge> : null}
    </div>
  );
}
