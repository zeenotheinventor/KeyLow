import { PlateProvider } from "../../../lib/plate";

import type { ReactNode } from "react";

/** Wraps a hook's render in a plate, as the food sheet's layout does. */
export function withPlate(props: { initialTime?: string } = {}) {
  return function PlateWrapper({ children }: { children: ReactNode }) {
    return <PlateProvider {...props}>{children}</PlateProvider>;
  };
}
