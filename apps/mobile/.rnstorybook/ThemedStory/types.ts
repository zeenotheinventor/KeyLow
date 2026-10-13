import type { ThemeScheme } from "@keylow/tokens";
import type { ReactNode } from "react";

export type ThemedStoryProps = {
  scheme: ThemeScheme;
  children: ReactNode;
};
