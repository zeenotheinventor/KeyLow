import { createContext } from "react";

import type { PlateContextValue, PlateExit, PlateLoggingGuard } from "./types";

export const PlateContext = createContext<
  (PlateContextValue & PlateLoggingGuard & PlateExit) | undefined
>(undefined);
