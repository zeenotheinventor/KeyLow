import type { WebCatalogueBadge } from "@keylow/core/copy";

export type BadgeTileProps = {
  badge: WebCatalogueBadge;
  /** Opens the badge's detail. */
  onOpen: (id: WebCatalogueBadge["id"]) => void;
};
