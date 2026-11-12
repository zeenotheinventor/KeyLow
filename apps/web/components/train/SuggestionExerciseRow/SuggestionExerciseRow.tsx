import type { SuggestionExerciseRowProps } from "./types";

/*
 * Written out whole so Tailwind sees each class. An exercise added to the plan sits on the accent wash
 * and says why in the primary tone, and one kept from the plan says so quietly.
 */
const rowClassNames = {
  added: "bg-accent-muted",
  planned: "",
} as const;
const whyClassNames = {
  added: "text-text-primary",
  planned: "text-text-muted",
} as const;
const dividerClassName = "border-t border-border";

/**
 * One exercise of the suggested session, as the `suggestion · detail` board draws it: the name and its
 * target on one line, and under them where it came from. `ListRow` has no line of this kind, so it is built
 * here. The name wraps when it is long, and so does the target, so a row never scrolls sideways.
 */
export function SuggestionExerciseRow({ row, hasDivider }: SuggestionExerciseRowProps) {
  const kind = row.added ? "added" : "planned";
  return (
    <li
      className={`flex flex-col gap-1 p-3 ${rowClassNames[kind]} ${hasDivider ? dividerClassName : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 flex-1 break-words text-body-strong">{row.name}</span>
        <span className="text-right text-caption tabular-nums text-text-secondary">
          {row.target}
        </span>
      </div>
      <span className={`break-words text-caption ${whyClassNames[kind]}`}>{row.why}</span>
    </li>
  );
}
