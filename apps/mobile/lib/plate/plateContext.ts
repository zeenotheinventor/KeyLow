import { createContext } from "react";

import type { PlateContextValue, PlateLoggingGuard } from "./types";

export const PlateContext = createContext<(PlateContextValue & PlateLoggingGuard) | undefined>(
  undefined,
);
