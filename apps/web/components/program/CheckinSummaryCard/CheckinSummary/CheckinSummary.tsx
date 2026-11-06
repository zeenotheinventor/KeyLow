import { PROGRAM_CHECKIN_SUMMARY } from "@keylow/core/copy";

import { SummaryLine } from "../SummaryLine";

import type { CheckinSummaryProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * The card as `program-default` and `program-checkin-not-measured` draw it: the eyebrow with the check-in's date
 * and the Measured or Not measured badge, the expenditure and the calorie target as two rows, and the lines that
 * say why. It is named "Last check-in, Friday 9 October, measured". On the first open after a new check-in it
 * cuts in from the side once, and under reduced motion it only fades.
 */
export function CheckinSummary({ view, isArriving }: CheckinSummaryProps) {
  return (
    <Card
      role="group"
      aria-label={view.name}
      className={cn(
        "flex flex-col gap-3",
        isArriving && "animate-kl-cut-in motion-reduce:animate-kl-fade-in",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-caption uppercase tracking-[0.04em] text-text-secondary">
            {PROGRAM_CHECKIN_SUMMARY.eyebrow}
          </span>
          <span className="text-body-strong tabular-nums">{view.dateText}</span>
        </div>
        <Badge tone={view.isMeasured ? "neutral" : "warning"}>
          {view.isMeasured ? PROGRAM_CHECKIN_SUMMARY.measured : PROGRAM_CHECKIN_SUMMARY.notMeasured}
        </Badge>
      </div>
      <div>
        {view.rows.map((row) => (
          <div
            key={row.label}
            role="group"
            aria-label={row.name}
            className="flex items-baseline justify-between gap-3 border-t border-border py-2"
          >
            <span className="text-body text-text-secondary">{row.label}</span>
            <span className="flex-1 text-right text-body-strong tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
      {view.lines.map((line) => (
        <SummaryLine key={`${line.kind}:${line.text}`} kind={line.kind} text={line.text} />
      ))}
    </Card>
  );
}
