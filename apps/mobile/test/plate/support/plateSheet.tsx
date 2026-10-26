import { ToastProvider } from "../../../components/ui";
import { PlateProvider, usePlate, useLogPlate } from "../../../lib/plate";
import { ThemeProvider } from "../../../lib/theme";

import type { LogContext } from "@keylow/core/diary";
import type { ReactNode } from "react";

/** The plate under the providers the food sheet has above it: the theme and the toasts. */
export function sheetProviders(props: { initialTime?: string } = {}) {
  return function SheetProviders({ children }: { children: ReactNode }) {
    return (
      <ThemeProvider fixedPreference="dark">
        <ToastProvider>
          <PlateProvider {...props}>{children}</PlateProvider>
        </ToastProvider>
      </ThemeProvider>
    );
  };
}

/** The plate and the action that logs it, as a screen of the sheet reads them. */
export function usePlateAndLogging(context: LogContext | undefined) {
  return { plate: usePlate(), logging: useLogPlate(context) };
}
