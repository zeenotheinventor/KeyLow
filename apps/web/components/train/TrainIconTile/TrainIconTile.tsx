import { iconStroke } from "@keylow/tokens";

import type { TrainIconTileProps } from "./types";

/** The 36 px tile with a secondary icon in it that the Train cards put before a line or a title, as the boards draw it. */
export function TrainIconTile({ icon: Icon }: TrainIconTileProps) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-small bg-surface-raised text-text-secondary">
      <Icon aria-hidden className="size-5" strokeWidth={iconStroke} />
    </span>
  );
}
