import type { ReactNode } from "react";

export type ProgramEditFrameProps = {
  onClose: () => void;
  /** Dims Close and stops it responding, while a save is under way. */
  isCloseInert?: boolean;
  children: ReactNode;
};
