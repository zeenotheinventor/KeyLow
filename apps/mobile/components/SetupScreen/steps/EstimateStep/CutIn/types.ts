import type { ReactNode } from "react";

export type CutInProps = {
  /** How long to wait before cutting in, in milliseconds. */
  delay: number;
  children: ReactNode;
};
