import type { LucideIcon } from "lucide-react";

export type TrainIconTileTone = "accent" | "success" | "raised";

export type TrainIconTileProps = {
  icon: LucideIcon;
  /** The tile's fill and its icon's colour. Raised, with a secondary icon, unless the card says otherwise. */
  tone?: TrainIconTileTone;
};
