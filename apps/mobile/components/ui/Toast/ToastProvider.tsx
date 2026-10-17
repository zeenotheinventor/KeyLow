import { tabBarHeight } from "@keylow/tokens";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Toast } from "./Toast";

import type { ToastContextValue, ToastOptions, ToastProviderProps } from "./types";

type CurrentToast = ToastOptions & { id: number };

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Kept apart from `ToastContext`, so a screen that only raises toasts does not render again when the
// clearance changes.
const ToastClearanceContext = createContext<((points: number) => void) | undefined>(undefined);

/**
 * Shows one toast at a time, above the tab bar. Mount it once, above every screen that shows one and
 * inside the safe area provider. A screen with a bar standing on the tab bar raises every toast over it
 * with `useToastClearance`.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [current, setCurrent] = useState<CurrentToast | undefined>(undefined);
  const lastId = useRef(0);
  const [clearance, setClearance] = useState(0);
  const { bottom: bottomInset } = useSafeAreaInsets();

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
      bottomClearance={clearance}
      bottomInset={bottomInset}
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
      <ToastClearanceContext.Provider value={setClearance}>
        {children}
        <View className="absolute inset-0" pointerEvents="box-none">
          {current === undefined ? null : renderToast(current)}
        </View>
      </ToastClearanceContext.Provider>
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

/**
 * Raises every toast by `points` while the calling screen is mounted, and puts them back when it goes. For a
 * screen with a bar standing on the tab bar, such as the diary's search dock, which a toast would sit behind.
 * It is the provider's, not the toast's, because a toast is often raised from another screen, such as the
 * portion picker saving and going back, and must still clear the bar of the screen it lands on. Pass the
 * height of the bar as measured with `onLayout`, and 0 while it is not drawn.
 */
export function useToastClearance(points: number): void {
  const setClearance = useContext(ToastClearanceContext);
  if (setClearance === undefined) {
    throw new Error("useToastClearance must be used inside a ToastProvider");
  }

  useEffect(() => {
    setClearance(points);
    return () => {
      setClearance(0);
    };
  }, [points, setClearance]);
}

/**
 * Raises every toast to sit above a bar of `points` standing on the bottom edge of a screen that has no tab
 * bar under it, such as the recipe editor's Save dock: 12 points above the bar, as it would be above the tab
 * bar. Pass the height of the bar as measured with `onLayout`, and 0 while it is not measured.
 */
export function useToastAboveBar(points: number): void {
  const { bottom: bottomInset } = useSafeAreaInsets();

  // The toast is placed above the tab bar and the safe area, which this screen does not have.
  useToastClearance(points === 0 ? 0 : points - tabBarHeight - bottomInset);
}
