import { useSyncExternalStore } from "react";

import {
  acknowledgeCelebrations,
  getCelebrationState,
  subscribeToCelebrations,
} from "./celebrationStore";

/** The badges waiting to be celebrated on this device, the same in every component that asks. */
export function useCelebrationQueue() {
  const state = useSyncExternalStore(subscribeToCelebrations, getCelebrationState);

  return { ...state, acknowledge: acknowledgeCelebrations };
}
