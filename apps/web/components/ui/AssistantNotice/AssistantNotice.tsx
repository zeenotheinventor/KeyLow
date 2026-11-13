import { iconStroke } from "@keylow/tokens";

import type { AssistantNoticeProps, AssistantNoticeTone } from "./types";

import { Button } from "@/components/ui/Button";

// The classes are written out so Tailwind sees them. The failed turn is the one notice with a coloured border.
const toneStyles: Record<
  AssistantNoticeTone,
  { box: string; tile: string; role: "alert" | "status" }
> = {
  neutral: { box: "border-border", tile: "bg-surface-raised text-text-secondary", role: "status" },
  danger: { box: "border-danger", tile: "bg-danger-muted [&_svg]:stroke-danger", role: "alert" },
};

/**
 * A message from the assistant's own plumbing, in the thread: a limit reached, the assistant switched off or a
 * failed turn (`web-assistant · day-limit`, `plus`, `resting`, `unavailable`). An icon tile and a title, the
 * paragraphs, and full-width buttons. Every word is the caller's. The title and paragraphs are announced as
 * one group, an alert for a failure and a status otherwise, and the buttons stay outside it.
 */
export function AssistantNotice({
  icon: Icon,
  tone = "neutral",
  title,
  paragraphs,
  buttons = [],
}: AssistantNoticeProps) {
  const style = toneStyles[tone];

  return (
    <div
      className={`flex shrink-0 flex-col gap-3 rounded-large border bg-surface p-4 ${style.box}`}
    >
      <div role={style.role} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={`flex size-9 shrink-0 items-center justify-center rounded-small ${style.tile}`}
          >
            <Icon className="size-5" strokeWidth={iconStroke} />
          </span>
          <p className="min-w-0 flex-1 text-body-strong">{title}</p>
        </div>
        {paragraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraph}`} className="text-body text-text-secondary">
            {paragraph}
          </p>
        ))}
      </div>
      {buttons.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          {buttons.map((button) => (
            <Button
              key={button.label}
              className="w-full"
              disabled={button.isDisabled === true}
              variant="secondary"
              onClick={button.onClick}
            >
              {button.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
