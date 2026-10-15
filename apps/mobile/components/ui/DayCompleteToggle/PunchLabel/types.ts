import type { ReactNode } from "react";

export type PunchLabelProps = {
  children: ReactNode;
  /** Whether the label punches in when it shows. Give the label a key per moment so each one punches. */
  isPunching: boolean;
};
