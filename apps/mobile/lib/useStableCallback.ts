import { useCallback, useEffect, useRef } from "react";

/**
 * A function that never changes between renders and always calls the latest `callback`, so it can be handed to a
 * memoised child without breaking its memo. The child must only call it from an event or an effect, never while
 * rendering, because the latest callback is in place once the render has committed.
 */
export function useStableCallback<Arguments extends unknown[], Result>(
  callback: (...args: Arguments) => Result,
): (...args: Arguments) => Result {
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  return useCallback((...args: Arguments) => latest.current(...args), []);
}
