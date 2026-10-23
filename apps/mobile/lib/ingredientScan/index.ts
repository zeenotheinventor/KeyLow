import { currentIngredientScanStore } from "./currentIngredientScanStore";

/** Starts a request for a scanned ingredient and returns its id, which the scanner's link carries. A second request replaces the first. */
export const beginIngredientScan = (): string => currentIngredientScanStore.store.begin();

/** The scanner's answer: the food it found for the request. It is ignored unless the request is the pending one. */
export const finishIngredientScan = (requestId: string, foodId: string): void => {
  currentIngredientScanStore.store.finish(requestId, foodId);
};

/** Takes the food a finished request found, once. Nothing before the scan has finished or after it was taken. */
export const takeIngredientScan = (requestId: string): string | undefined =>
  currentIngredientScanStore.store.take(requestId);

/** Drops the request, as when the editor that began it goes away. */
export const cancelIngredientScan = (requestId: string): void => {
  currentIngredientScanStore.store.cancel(requestId);
};

/** Tells the listener whenever a result arrives for the pending request. Returns what stops it. */
export const subscribeIngredientScan = (listener: () => void): (() => void) =>
  currentIngredientScanStore.store.subscribe(listener);
