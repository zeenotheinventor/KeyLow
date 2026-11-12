import { iconStroke } from "@keylow/tokens";
import { CircleAlert, CircleCheck, Info } from "lucide-react";

import type { SummaryLineProps } from "./types";

/**
 * One line of the check-in summary, as `program-checkin-not-measured` and `program-checkin-guardrail` draw
 * them: a 16 px icon before the caption, which is a check for the data line, an info mark for a guardrail and
 * an alert in the warning ink for a reason. A plain line has no icon and is indented by the icon's width.
 */
export function SummaryLine({ kind, text }: SummaryLineProps) {
  return (
    <div className="flex items-start gap-2">
      {kind === "data" && (
        <CircleCheck
          aria-hidden
          className="size-4 shrink-0 text-text-secondary"
          strokeWidth={iconStroke}
        />
      )}
      {kind === "guardrail" && (
        <Info
          aria-hidden
          className="size-4 shrink-0 text-text-secondary"
          strokeWidth={iconStroke}
        />
      )}
      {kind === "reason" && (
        <CircleAlert
          aria-hidden
          className="size-4 shrink-0 text-warning-ink"
          strokeWidth={iconStroke}
        />
      )}
      {kind === "plain" && <span aria-hidden className="w-4 shrink-0" />}
      <span className="min-w-0 flex-1 text-caption tabular-nums text-text-secondary">{text}</span>
    </div>
  );
}
