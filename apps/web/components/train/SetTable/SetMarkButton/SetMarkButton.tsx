import type { SetMarkButtonProps } from "./types";

// The button's own padding is taken back by a negative margin, so the mark stands where the plain text stood,
// under its column heading, and the hover and focus ring reach a little past it. Below the md breakpoint an
// invisible pseudo element reaches the 44 px row height. It reads as the plain mark until it is hovered or
// focused. It stays focusable while it is inert (aria-disabled, not disabled), so focus returned to it after a
// change is not lost.
const classes =
  "-ml-1 inline-flex h-control-sm min-w-8 items-center justify-start rounded-small px-1 text-inherit outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset aria-disabled:cursor-default aria-disabled:hover:bg-transparent max-md:relative max-md:after:absolute max-md:after:-inset-y-1 max-md:after:inset-x-0";

/** The mark at the start of a set's row (W, the number, D or F), as a button that opens the set types dialog. */
export function SetMarkButton({ name, label, onPress }: SetMarkButtonProps) {
  return (
    <button
      type="button"
      aria-label={name}
      aria-disabled={onPress === undefined ? true : undefined}
      className={classes}
      onClick={onPress}
    >
      {label}
    </button>
  );
}
