import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Toast } from "./Toast";

import type { ToastContextValue, ToastOptions, ToastProviderProps } from "./types";

type CurrentToast = ToastOptions & { id: number };

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Shows one toast at a time, at the top of the screen under the status bar, above every screen and its
 * header. Mount it once, above every screen that shows one and inside the safe area provider.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [current, setCurrent] = useState<CurrentToast | undefined>(undefined);
  const lastId = useRef(0);
  const { top: topInset } = useSafeAreaInsets();

  // iOS has no live region, so every toast is spoken through the accessibility service, once per show,
  // which also repeats a message that matches the last one. The toast's own words stay readable, so a
  // user who swipes to the action hears what it acts on.
  const show = useCallback((options: ToastOptions) => {
    AccessibilityInfo.announceForAccessibility(options.message);
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
      // A new toast is a new element, so it fades in again and gets its own full wait.
      key={id}
      topInset={topInset}
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
      {/* The layer fills the screen and takes no touch of its own, so only the card does. */}
      <View className="absolute inset-0" pointerEvents="box-none" testID="toast-layer">
        {current === undefined ? null : renderToast(current)}
      </View>
    </ToastContext.Provider>
  );
}

/**
 * Gives a screen `show`. A toast's action is a shortcut: never make it the only way to recover from an
 * action, because the toast is gone after its 5 second wait.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used inside a ToastProvider");
  }
  return context;
}
