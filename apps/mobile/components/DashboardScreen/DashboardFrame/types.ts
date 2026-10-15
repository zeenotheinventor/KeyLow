import type { ReactNode } from "react";

export type DashboardFrameProps = {
  /** Today's date in words. Left off until the profile's time zone is known. */
  eyebrow?: string | undefined;
  children: ReactNode;
};
