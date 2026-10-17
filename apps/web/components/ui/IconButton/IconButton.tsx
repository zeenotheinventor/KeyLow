import { iconStroke } from "@keylow/tokens";
import * as React from "react";

import type { IconButtonProps } from "./types";
// A 36 px square with the design's small radius, the icon at 18 px. Below the md breakpoint, where a
// finger is the pointer, an invisible pseudo element reaches 4 px past each edge to a 44 px target, so
// the drawn size and the layout stay the same. The button does not clip, or the reach would be cut off.
// The fill is the button's own background, because the overlay tokens are translucent.
const baseClassName =
  "relative inline-flex h-control-sm w-control-sm shrink-0 items-center justify-center rounded-small text-text-secondary outline-none transition-transform duration-instant ease-spring hover:bg-hover-overlay active:scale-press active:bg-press-overlay motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset disabled:pointer-events-none disabled:opacity-40 max-md:after:absolute max-md:after:-inset-1 [&_svg]:size-[18px] [&_svg]:pointer-events-none [&_svg]:shrink-0";

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, ...props }, ref) => (
    <button type="button" aria-label={label} className={baseClassName} ref={ref} {...props}>
      <Icon aria-hidden strokeWidth={iconStroke} />
    </button>
  ),
);
IconButton.displayName = "IconButton";

export { IconButton };
