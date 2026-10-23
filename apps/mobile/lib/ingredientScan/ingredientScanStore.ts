type PendingScan = {
  requestId: string;
  /** The food the scan found, until the editor takes it. */
  foodId?: string;
};

/**
 * The hand-back from the scanner to the recipe editor that asked for it. A route cannot return a value, so
 * the editor begins a request, passes its id to the scanner in the link, and the scanner finishes the
 * request with the food it found. Nothing is stored on the device: the request lives as long as the app
 * does. Only one request is pending, so a result can only reach the editor that asked last, and an id
 * that is not the pending one, such as a link someone made up, is ignored.
 */
export function createIngredientScanStore() {
  let pending: PendingScan | undefined;
  let requestCount = 0;
  const listeners = new Set<() => void>();

  return {
    begin: (): string => {
      requestCount += 1;
      const requestId = `scan-${requestCount}`;
      pending = { requestId };
      return requestId;
    },
    finish: (requestId: string, foodId: string) => {
      if (pending?.requestId !== requestId) {
        return;
      }
      pending = { requestId, foodId };
      listeners.forEach((listener) => {
        listener();
      });
    },
    /** Hands over the food the request found, and ends the request. It is nothing until the scan has finished. */
    take: (requestId: string): string | undefined => {
      if (pending?.requestId !== requestId || pending.foodId === undefined) {
        return undefined;
      }
      const { foodId } = pending;
      pending = undefined;
      return foodId;
    },
    cancel: (requestId: string) => {
      if (pending?.requestId === requestId) {
        pending = undefined;
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
