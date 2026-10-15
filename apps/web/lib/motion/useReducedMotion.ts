import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

const subscribe = (onChange: () => void) => {
  if (typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const list = window.matchMedia(query);
  list.addEventListener("change", onChange);
  return () => {
    list.removeEventListener("change", onChange);
  };
};

const getSnapshot = () =>
  typeof window.matchMedia === "function" && window.matchMedia(query).matches;

/** Whether the person asked their system for less motion. It follows the setting while the page is open. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
