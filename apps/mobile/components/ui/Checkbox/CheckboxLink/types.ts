import type { ReactNode } from "react";

export type CheckboxLinkProps = {
  children: ReactNode;
  /** Opens the page the link names. It runs instead of the checkbox toggling. */
  onPress: () => void;
};
