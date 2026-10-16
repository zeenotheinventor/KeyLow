import { focusManager } from "@tanstack/react-query";
import { AppState } from "react-native";

/**
 * Makes React Query's focus manager follow whether the app is in the foreground. React Native has no window
 * focus event, so without this a stale query never refetches when the app returns from the background, and a
 * food logged elsewhere does not show until something else refetches it. `setEventListener` runs the
 * subscription at once, and the manager removes it when its last listener goes and adds it again with the next.
 */
export function feedFocusManager(): void {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener("change", (state) => {
      setFocused(state === "active");
    });

    return () => {
      subscription.remove();
    };
  });
}
