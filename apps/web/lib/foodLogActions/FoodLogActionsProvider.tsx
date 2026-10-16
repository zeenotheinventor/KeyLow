"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useRef, useState } from "react";

import type { AddFoodRequest, FoodLogActions, FoodLogActionsProviderProps } from "./types";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { EditEntryDialog } from "@/components/diary/EditEntryDialog";
import { QuickAddDialog } from "@/components/diary/QuickAddDialog";

// Each request gets its own number, so a request made while a dialog is open starts a fresh dialog. The
// opener is the control that was focused when the first dialog opened, and it is carried across a switch
// from one dialog to another, so closing the last one gives focus back to the diary and not to a dialog
// that is gone.
type OpenDialog = { opener: Element | null; id: number } & (
  | { kind: "add" | "quick"; request: AddFoodRequest }
  | { kind: "edit"; entryId: string; date: string }
);

// A request that waits for the page to change, with the number its dialog will have.
type WaitingRequest = { request: AddFoodRequest; id: number };

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
  const [waitingRequest, setWaitingRequest] = useState<WaitingRequest | undefined>(undefined);
  const requestCount = useRef(0);

  // A dialog belongs to the page it was opened on, so going to another page closes it. The one exception
  // is a request that was made to open on the next page, which opens there instead.
  if (dialogPathname !== pathname) {
    setDialogPathname(pathname);
    setWaitingRequest(undefined);
    setDialog(
      waitingRequest === undefined
        ? undefined
        : { kind: "add", request: waitingRequest.request, id: waitingRequest.id, opener: null },
    );
  }

  const value = useMemo<FoodLogActions>(
    () => ({
      openAddFood: (request) => {
        requestCount.current += 1;
        const id = requestCount.current;
        setDialog((current) => ({
          kind: "add",
          request,
          id,
          opener: current?.opener ?? document.activeElement,
        }));
      },
      openAddFoodOnNextPage: (request) => {
        requestCount.current += 1;
        setWaitingRequest({ request, id: requestCount.current });
      },
      openQuickAdd: (request) => {
        requestCount.current += 1;
        const id = requestCount.current;
        setDialog((current) => ({
          kind: "quick",
          request,
          id,
          opener: current?.opener ?? document.activeElement,
        }));
      },
      openEditEntry: (entryId) => {
        // An entry is edited on the diary's day on view, so away from the diary there is nothing to edit.
        if (viewedDate !== undefined) {
          requestCount.current += 1;
          const id = requestCount.current;
          setDialog((current) => ({
            kind: "edit",
            entryId,
            date: viewedDate,
            id,
            opener: current?.opener ?? document.activeElement,
          }));
        }
      },
      viewedDate,
      setViewedDate,
    }),
    [viewedDate],
  );

  function closeDialog() {
    setDialog(undefined);
  }

  return (
    <FoodLogActionsContext.Provider value={value}>
      {children}
      {dialog?.kind === "add" && (
        <AddFoodDialog
          key={dialog.id}
          request={dialog.request}
          opener={dialog.opener}
          onClose={closeDialog}
          onQuickAdd={() => {
            value.openQuickAdd(dialog.request);
          }}
        />
      )}
      {dialog?.kind === "quick" && (
        <QuickAddDialog
          key={dialog.id}
          request={dialog.request}
          opener={dialog.opener}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === "edit" && (
        <EditEntryDialog
          key={dialog.id}
          entryId={dialog.entryId}
          date={dialog.date}
          opener={dialog.opener}
          onClose={closeDialog}
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
