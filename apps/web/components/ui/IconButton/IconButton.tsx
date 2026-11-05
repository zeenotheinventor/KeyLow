import { iconStroke } from "@keylow/tokens";
import * as React from "react";

import type { IconButtonProps, IconButtonSize } from "./types";
// The default is a 36 px square with the design's small radius, the icon at 18 px. At every width an invisible
// pseudo element reaches 4 px past each edge to a 44 px target, so the drawn size and the layout stay the same.
// The card size is the body map card's 40 px square with the medium radius, a border and a raised fill,
// which reaches 2 px past each edge to the same 44 px target. No token names 40 px. The button does not clip,
// or the reach would be cut off. Buttons set side by side with less than 8 px between them share the
// overlap, where the later one answers. The fill is the button's own background, because the overlay tokens
// are translucent.
const baseClassName =
  "relative inline-flex shrink-0 items-center justify-center outline-none transition-transform duration-instant ease-spring active:scale-press motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset disabled:pointer-events-none disabled:opacity-40 after:absolute [&_svg]:size-[18px] [&_svg]:pointer-events-none [&_svg]:shrink-0";

const sizeClassName: Record<IconButtonSize, string> = {
  default: "h-control-sm w-control-sm rounded-small after:-inset-1",
  card: "h-[40px] w-[40px] rounded-medium border after:-inset-[2px]",
};

// The look of the button at rest and when it is selected. A selected button swaps its fill and border for the
// accent's and its glyph for accent ink, and keeps them under the pointer, as the board draws it. The card
// size has the border and the raised fill at rest, and the default size has neither.
const lookClassName: Record<IconButtonSize, { rest: string; selected: string }> = {
  default: {
    rest: "text-text-secondary hover:bg-hover-overlay active:bg-press-overlay",
    selected: "border border-accent bg-accent-muted text-accent-ink",
  },
  card: {
    rest: "border-border bg-surface-raised text-text-primary hover:bg-hover-overlay active:bg-press-overlay",
    selected: "border-accent bg-accent-muted text-accent-ink",
  },
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, size = "default", isSelected = false, ...props }, ref) => (
    <button
      type="button"
      aria-label={label}
      className={`${baseClassName} ${sizeClassName[size]} ${lookClassName[size][isSelected ? "selected" : "rest"]}`}
      ref={ref}
      {...props}
    >
      <Icon aria-hidden strokeWidth={iconStroke} />
    </button>
  ),
);
IconButton.displayName = "IconButton";

export { IconButton };
