"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useRef, useState } from "react";

import type { AddFoodRequest, FoodLogActions, FoodLogActionsProviderProps } from "./types";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";

// Each request gets its own number, so a request made while a dialog is open starts a fresh dialog.
type OpenDialog = { kind: "add"; request: AddFoodRequest; id: number };

const FoodLogActionsContext = createContext<FoodLogActions | undefined>(undefined);

/**
 * Holds the food log's page-level actions and the day on view, so the diary's hour plusses, its Edit
 * buttons and the top bar's search all reach the same dialogs. Mount it once, above the top bar and the
 * pages, inside the toast and query providers the dialogs use. One dialog is open at a time, and a dialog
 * closes when the page under it changes.
 */
export function FoodLogActionsProvider({ children }: FoodLogActionsProviderProps) {
  const pathname = usePathname();
  const [viewedDate, setViewedDate] = useState<string | undefined>(undefined);
  const [dialog, setDialog] = useState<OpenDialog | undefined>(undefined);
  const [dialogPathname, setDialogPathname] = useState(pathname);
  const requestCount = useRef(0);

  // A dialog belongs to the page it was opened on, so going to another page closes it.
  if (dialogPathname !== pathname) {
    setDialogPathname(pathname);
    setDialog(undefined);
  }

  const value = useMemo<FoodLogActions>(
    () => ({
      openAddFood: (request) => {
        requestCount.current += 1;
        setDialog({ kind: "add", request, id: requestCount.current });
      },
      openEditEntry: () => undefined,
      viewedDate,
      setViewedDate,
    }),
    [viewedDate],
  );

  return (
    <FoodLogActionsContext.Provider value={value}>
      {children}
      {dialog?.kind === "add" && (
        <AddFoodDialog
          key={dialog.id}
          request={dialog.request}
          onClose={() => {
            setDialog(undefined);
          }}
        />
      )}
    </FoodLogActionsContext.Provider>
  );
}

export function useFoodLogActions(): FoodLogActions {
  const context = useContext(FoodLogActionsContext);
  if (context === undefined) {
    throw new Error("useFoodLogActions must be used inside a FoodLogActionsProvider");
  }
  return context;
}
