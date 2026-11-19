import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

const subscribe = (listener: () => void): (() => void) => {
  const subscription = AppState.addEventListener("change", listener);
  return () => {
    subscription.remove();
  };
};

const getSnapshot = (): boolean => AppState.currentState === "active";

/** Whether the app is in front, so a celebration waits for the person to be looking. */
export function useIsAppActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
