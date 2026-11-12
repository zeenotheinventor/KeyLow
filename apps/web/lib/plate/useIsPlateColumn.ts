import { useSyncExternalStore } from "react";

// From 1024 px the dialog has room for Your plate as a column beside the results, and below it is a step.
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

/** Whether Your plate opens as a column beside the results (1024 px and up) and not as a step of the dialog. It follows the window. */
export function useIsPlateColumn(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
