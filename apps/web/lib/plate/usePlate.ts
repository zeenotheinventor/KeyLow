import { useContext } from "react";

import { PlateContext } from "./PlateContext";

import type { PlateContextValue } from "./types";

/** The plate of the open Add food dialog. Only what the dialog draws may call it. */
export function usePlate(): PlateContextValue {
  const plate = useContext(PlateContext);
  if (plate === undefined) {
    throw new Error("usePlate must be used inside a PlateProvider");
  }

  return plate;
}
