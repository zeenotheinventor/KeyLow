import type { ViewLabelProps, ViewNameProps } from "./types";

import { cn } from "@/lib/utils";

/**
 * The name of a view with its dot, such as the one over each figure of the side by side view: solid for
 * Actual and a dashed ring for Projected. The text takes the class it is given, since a name over a figure
 * is set smaller than the label of the card.
 */
export function ViewName({
  label,
  isProjected,
  textClassName = "text-body-strong",
}: ViewNameProps) {
  return (
    <span className={cn("flex items-center gap-2", textClassName)}>
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full border-[1.5px] border-text-primary",
          isProjected ? "border-dashed bg-transparent" : "bg-text-primary",
        )}
      />
      {label}
    </span>
  );
}

/**
 * The view the body map shows, as its board draws it: a dot over the view's name and the moment under it.
 * The dot is solid for Actual and a dashed ring for Projected. It is a live region, so a screen reader
 * announces the new view and moment when the toggle switches them.
 */
export function ViewLabel({ label, subLine, isProjected, className }: ViewLabelProps) {
  return (
    <div role="status" className={cn("flex flex-col gap-0.5", className)}>
      <ViewName label={label} isProjected={isProjected} />
      <span className="text-caption text-text-muted">{subLine}</span>
    </div>
  );
}
