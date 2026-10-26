import { useContext } from "react";

import { PlateContext } from "./plateContext";

import type { PlateContextValue, PlateExit, PlateLoggingGuard } from "./types";

function usePlateContext() {
  const plate = useContext(PlateContext);
  if (plate === undefined) {
    throw new Error("usePlate must be used inside a PlateProvider");
  }

  return plate;
}

/**
 * The plate of the open food sheet. Only the screens of the sheet's own stack may call it: the recipe
 * editor's ingredient search shows the same search outside the sheet, and it logs nothing.
 */
export function usePlate(): PlateContextValue {
  return usePlateContext();
}

/** The hold `useLogPlate` takes on the plate while it logs. */
export function usePlateLoggingGuard(): PlateLoggingGuard {
  return usePlateContext();
}

/** The question "Discard your plate?", which the search's guard asks and the sheet's layout draws. */
export function usePlateExit(): PlateExit {
  return usePlateContext();
}
