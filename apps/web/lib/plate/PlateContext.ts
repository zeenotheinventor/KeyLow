import { createContext } from "react";

import type { PlateContextValue } from "./types";

export const PlateContext = createContext<PlateContextValue | undefined>(undefined);
