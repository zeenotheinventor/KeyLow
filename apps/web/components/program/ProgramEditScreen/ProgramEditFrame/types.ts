import type { ReactNode } from "react";

export type ProgramEditFrameProps = {
  /** The back link is dimmed and takes no press or focus, as while a save runs. */
  isBackInert?: boolean;
  /** The sticky footer, which sits under the page and spans the window. */
  footer?: ReactNode;
  children: ReactNode;
};
