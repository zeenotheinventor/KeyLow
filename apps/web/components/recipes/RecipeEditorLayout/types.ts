import type { ReactNode } from "react";

export type RecipeEditorLayoutProps = {
  /** Banners for what the page has to say, above the cards. Leave it out when there is nothing to say. */
  notices?: ReactNode;
  /** The Per serving card, and whatever else belongs in the column beside the cards. */
  summary: ReactNode;
  /** Save and Cancel. Below the large width only Save is drawn, pinned to the bottom of the screen. A page with no actions leaves it out. */
  actions?: ReactNode;
  /** The cards of the recipe. */
  children: ReactNode;
};
