import type { ReactNode } from "react";

export type DashboardFrameProps = {
  /** Today's date in words, in the muted caption above the title. Its line keeps its height until the date is known. */
  eyebrow?: string;
  /** What fills the first column: banners, then the card or what stands in for it. */
  children: ReactNode;
};
