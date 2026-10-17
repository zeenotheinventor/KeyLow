import type { ReactNode } from "react";

export type RecipeEditorFrameProps = {
  /** The way back, above the title. */
  backLink: ReactNode;
  /** The heading of the page. Leave it out where the content brings its own, as the loading state does. */
  title?: string | undefined;
  children: ReactNode;
};
