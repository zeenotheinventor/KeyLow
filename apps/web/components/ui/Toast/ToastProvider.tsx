"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { Toast } from "./Toast";

import type { ToastContextValue, ToastOptions, ToastProviderProps } from "./types";

type CurrentToast = ToastOptions & { id: number };

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** Shows one toast at a time, on the viewport. Mount it once, above every screen that shows one. */
export function ToastProvider({ children }: ToastProviderProps) {
  const [current, setCurrent] = useState<CurrentToast | undefined>(undefined);
  const lastId = useRef(0);

  const show = useCallback((options: ToastOptions) => {
    lastId.current += 1;
    setCurrent({ ...options, id: lastId.current });
  }, []);
  const dismiss = useCallback(() => {
    setCurrent(undefined);
  }, []);
  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  // Closes only the toast it was made for, so a toast that has replaced it is left alone.
  const closeToast = (id: number) => {
    setCurrent((toast) => (toast?.id === id ? undefined : toast));
  };

  const renderToast = ({ id, ...options }: CurrentToast) => (
    <Toast
      // A new toast is a new element, so it cuts in again and gets its own full wait.
      key={id}
      position="fixed"
      announce={false}
      {...options}
      onAction={() => {
        try {
          options.onAction?.();
        } finally {
          closeToast(id);
        }
      }}
      onClose={() => {
        closeToast(id);
      }}
    />
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* One live region for the whole session, mounted before any toast, so every toast is announced
          even when its words match the last one. */}
      <div role="status">{current === undefined ? null : renderToast(current)}</div>
    </ToastContext.Provider>
  );
}

/**
 * Gives a screen `show`, and `dismiss` for a toast whose action would no longer mean what it said.
 * A toast's action is a shortcut: never make it the only way to recover from an action, because a
 * keyboard user may not reach the toast within its 5 s wait.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
