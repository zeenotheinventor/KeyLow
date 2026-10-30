import type { ViewLabelProps } from "./types";

import { cn } from "@/lib/utils";

/**
 * The view the body map shows, as its board draws it: a dot over the view's name and the moment under it.
 * The dot is solid for Actual and a dashed ring for Projected. It is a live region, so a screen reader
 * announces the new view and moment when the toggle switches them.
 */
export function ViewLabel({ label, subLine, isProjected, className }: ViewLabelProps) {
  return (
    <div role="status" className={cn("flex flex-col gap-0.5", className)}>
      <span className="flex items-center gap-2 text-body-strong">
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full border-[1.5px] border-text-primary",
            isProjected ? "border-dashed bg-transparent" : "bg-text-primary",
          )}
        />
        {label}
      </span>
      <span className="text-caption text-text-muted">{subLine}</span>
    </div>
  );
}
