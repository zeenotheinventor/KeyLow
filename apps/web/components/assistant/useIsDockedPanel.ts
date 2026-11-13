import { useSyncExternalStore } from "react";

// From 1024 px the panel is docked beside the page, and below it the panel is a sheet over the page.
const query = "(min-width: 1024px)";

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

/** Whether the panel is docked beside the page (1024 px and up) and not a modal sheet over it. It follows the window. */
export function useIsDockedPanel(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
