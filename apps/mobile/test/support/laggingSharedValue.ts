import { useMemo } from "react";

// The real one, because a test replaces the module's `useSharedValue` with the stand-in below.
const { useSharedValue } =
  jest.requireActual<typeof import("react-native-reanimated")>("react-native-reanimated");

/** Every number the JavaScript thread has set on a lagging shared value, in order. */
export const laggingWrites: number[] = [];

/**
 * A stand-in for `useSharedValue` that behaves as the shared value does on a device with the JavaScript thread
 * as the writer: a read on that thread still gives the value from before the latest number was set, because the
 * write goes to the UI thread first. Jest's own shared value is synchronous, so it cannot show a read that lags.
 * An animation is moved by the UI thread, so a read after one is set gives the real, current value.
 */
export function useLaggingSharedValue(initial: number) {
  const real = useSharedValue(initial);
  return useMemo(() => {
    const lag: { before: number | null } = { before: null };
    return {
      get: () => lag.before ?? real.get(),
      set: (value: Parameters<typeof real.set>[0]) => {
        if (typeof value === "number") {
          lag.before = real.get();
          laggingWrites.push(value);
        } else {
          lag.before = null;
        }
        real.set(value);
      },
    };
  }, [real]);
}
