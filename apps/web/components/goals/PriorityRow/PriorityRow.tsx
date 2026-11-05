import type { PriorityRowProps } from "./types";
import type { PriorityRowGroup } from "@keylow/core/copy";

// The volume scale's colours for the three groups, from the tokens, and the muted text colour for the row
// that restates the days, minutes and equipment. Not targeted draws a border so the swatch reads in the
// light theme. The classes are written out so Tailwind sees them.
const swatchClassNames: Record<PriorityRowGroup, string> = {
  first: "bg-volume-productive",
  keptUp: "bg-volume-maintaining",
  notTargeted: "border border-border-strong bg-volume-not-trained",
  fit: "bg-text-muted",
};

/**
 * One row of "Your priorities": a swatch of the group's colour, the title and under it the description. The
 * swatch is decoration, because the title says what the colour means, so colour is never the only signal.
 */
export function PriorityRow({ group, title, detail }: PriorityRowProps) {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className={`mt-[6px] size-[10px] shrink-0 rounded-[3px] ${swatchClassNames[group]}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className="text-body-strong">{title}</span>
        {detail === null ? null : (
          <span className="text-caption text-text-secondary">{detail}</span>
        )}
      </div>
    </div>
  );
}
