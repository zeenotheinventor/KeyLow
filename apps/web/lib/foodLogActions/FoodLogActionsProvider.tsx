"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";

import type { FoodLogActions, FoodLogActionsProviderProps } from "./types";

const FOODS_HREF = "/foods";

const FoodLogActionsContext = createContext<FoodLogActions | undefined>(undefined);

/**
 * Holds the food log's two page-level actions and the day on view, so the diary's hour plusses, its
 * Edit buttons and the top bar's search all reach the same place. Mount it once, above the top bar and
 * the pages. The add and edit dialogs are KEY-211's: they replace the two functions here.
 */
export function FoodLogActionsProvider({ children }: FoodLogActionsProviderProps) {
  const router = useRouter();
  const [viewedDate, setViewedDate] = useState<string | undefined>(undefined);

  const value = useMemo<FoodLogActions>(
    () => ({
      openAddFood: () => {
        router.push(FOODS_HREF);
      },
      openEditEntry: () => undefined,
      viewedDate,
      setViewedDate,
    }),
    [router, viewedDate],
  );

  return <FoodLogActionsContext.Provider value={value}>{children}</FoodLogActionsContext.Provider>;
}

export function useFoodLogActions(): FoodLogActions {
  const context = useContext(FoodLogActionsContext);
  if (context === undefined) {
    throw new Error("useFoodLogActions must be used inside a FoodLogActionsProvider");
  }
  return context;
}
