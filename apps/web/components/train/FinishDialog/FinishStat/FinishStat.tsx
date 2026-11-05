import { useId } from "react";

import type { FinishStatProps } from "./types";

import { Card } from "@/components/ui/Card";

/** One of the three cards at the top of the finish dialog: a label, a figure and a line under it. */
export function FinishStat({ label, value, note }: FinishStatProps) {
  const labelId = useId();

  return (
    <Card
      padding="none"
      role="group"
      aria-labelledby={labelId}
      className="flex min-w-0 flex-col gap-0.5 p-3"
    >
      <span id={labelId} className="text-caption text-text-muted">
        {label}
      </span>
      <span className="text-numeral-small tabular-nums">{value}</span>
      {note === null ? null : <span className="text-caption text-text-secondary">{note}</span>}
    </Card>
  );
}
