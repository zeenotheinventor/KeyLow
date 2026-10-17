import type { RecipeViewStepRowProps } from "./types";

/** One step of the recipe view: the number in a circle and the full text beside it. It is not pressable. */
export function RecipeViewStepRow({ number, text }: RecipeViewStepRowProps) {
  return (
    <li className="flex items-start gap-3 border-t border-border px-4 py-3">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-pill border border-border bg-surface-raised text-caption font-semibold tabular-nums"
      >
        {number}
      </span>
      <span className="min-w-0 flex-1 break-words text-body">{text}</span>
    </li>
  );
}
