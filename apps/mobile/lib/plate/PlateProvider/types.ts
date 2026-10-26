import type { ReactNode } from "react";

export type PlateProviderProps = {
  children: ReactNode;
  /** The hour an hour's plus opened the sheet on (`HH:mm`), which the plate is logged at. Without it the plate is logged now. */
  initialTime?: string | undefined;
};
