import type { ThemeScheme } from "@keylow/tokens";
import type { ReactNode } from "react";

export type ThemeScopeProps = {
  /** The scheme everything inside is drawn in, whatever the app's is. */
  scheme: ThemeScheme;
  children: ReactNode;
  /** Classes for the view that holds the scope. It needs a size of its own, or its children have none. */
  className?: string;
};
