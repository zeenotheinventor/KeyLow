import type * as React from "react";

export type BackToFoodsLinkProps = {
  /** What the link says. The detail screen says "Back to foods", and the food forms say "Back". */
  label?: string;
  /** Where it goes. A screen outside the foods section, such as a recipe's, gives its own. */
  href?: string;
  /** Called on a press. A screen that asks before leaving calls `preventDefault` and opens its question. */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  /** `accent` is the recipe pages' link: the accent ink, a 44 px target and an 18 px chevron. */
  tone?: "quiet" | "accent";
  /** The link's element, for a screen that hands focus to it. */
  ref?: React.Ref<HTMLAnchorElement>;
};
