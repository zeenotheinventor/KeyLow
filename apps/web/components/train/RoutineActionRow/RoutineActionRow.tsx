import type { RoutineActionRowProps } from "./types";

import { Button } from "@/components/ui/Button";

// The row sits inside a card that clips its corners, so the keyboard focus ring is drawn inside the row.
const openClasses =
  "flex min-w-0 flex-1 flex-col gap-0.5 self-stretch justify-center rounded-small text-left text-text-primary outline-none transition-colors duration-quick hover:bg-hover-overlay active:bg-press-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

/**
 * A routine of a list as the `routines · list` and `routines · archived` boards draw it: the name and what
 * the routine holds on the left, and one secondary button on the right (Make active, or Restore). The
 * words open the routine's editor when `onOpen` is given, and the button is drawn only when `onAction` is. Put it inside a `GroupedList`.
 */
export function RoutineActionRow({
  title,
  subtitle,
  onOpen,
  actionLabel,
  actionName,
  onAction,
  isActionDisabled,
  actionDescribedBy,
  actionRef,
}: RoutineActionRowProps) {
  const text = (
    <>
      <span className="text-body-strong">{title}</span>
      <span className="text-caption text-text-muted">{subtitle}</span>
    </>
  );

  return (
    <li className="flex min-h-[64px] items-center gap-2 py-2 pl-3 pr-1">
      {onOpen === undefined ? (
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">{text}</span>
      ) : (
        <button type="button" className={openClasses} onClick={onOpen}>
          {text}
        </button>
      )}
      {onAction === undefined ? null : (
        <Button
          ref={actionRef}
          variant="secondary"
          size="sm"
          className="text-label-small"
          disabled={isActionDisabled}
          aria-label={actionName}
          aria-describedby={isActionDisabled ? actionDescribedBy : undefined}
          onClick={(event) => {
            onAction(event.currentTarget);
          }}
        >
          {actionLabel}
        </Button>
      )}
    </li>
  );
}
