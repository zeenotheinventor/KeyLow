import { describeRoleRow } from "@keylow/core/copy";

import type { RoleRowProps } from "./types";
import type { MuscleRole } from "@keylow/core/training";

// The role scale's colours, from the tokens. The classes are written out so Tailwind sees them.
const swatchClasses: Record<MuscleRole, string> = {
  primary: "bg-role-primary",
  secondary: "bg-role-secondary",
  stabiliser: "bg-role-assist",
};

/**
 * One role of the Muscles it works dialog: its colour as a swatch, the muscles that have it, and under them
 * the role and what a set counts for. The row is named in words ("Glutes, Hamstrings, Secondary · counts
 * half"), so the swatch's colour is never the only way to read the role.
 */
export function RoleRow({ role, muscles, hasDivider }: RoleRowProps) {
  const row = describeRoleRow(role, muscles);

  return (
    <div
      role="listitem"
      aria-label={`${row.muscles}, ${row.role}`}
      className={`flex min-h-12 items-center gap-3 px-3 py-2${hasDivider ? " border-t border-border" : ""}`}
    >
      <span
        aria-hidden
        className={`size-3.5 shrink-0 rounded-[4px] border border-border ${swatchClasses[role]}`}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-strong">{row.muscles}</span>
        <span className="text-caption text-text-secondary">{row.role}</span>
      </span>
    </div>
  );
}
