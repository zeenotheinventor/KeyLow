import { createContext } from "react";

import type { SetupFlowValue } from "./types";

export const SetupFlowContext = createContext<SetupFlowValue | undefined>(undefined);
