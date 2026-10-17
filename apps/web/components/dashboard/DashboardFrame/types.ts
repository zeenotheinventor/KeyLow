import type { ReactNode } from "react";

export type DashboardFrameProps = {
  /** Today's date in words, in the muted caption above the title. Its line keeps its height until the date is known. */
  eyebrow?: string;
  /** The notices that span the page, over both columns. */
  banners?: ReactNode;
  /** What fills the second column: the This week card or what stands in for it. */
  aside?: ReactNode;
  /** What fills the first column: the card or what stands in for it. */
  children: ReactNode;
};
