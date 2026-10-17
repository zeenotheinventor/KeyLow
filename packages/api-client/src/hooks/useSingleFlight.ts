import { useRef } from "react";

type Flight<Output> = { key: string; promise: Promise<Output> };

/**
 * Makes a save not re-entrant. While a call is pending, a call with the same input (a double press of
 * Save) does not start a second request: it gets the pending call's promise, so both presses see its
 * result. A call with a different input is a different edit, so it runs after the pending call
 * settles, whether that one succeeded or failed, and the last save wins. The inputs are plain data,
 * so they are compared by their JSON.
 */
export function useSingleFlight<Input, Output>(run: (input: Input) => Promise<Output>) {
  const latest = useRef<Flight<Output> | null>(null);

  return (input: Input): Promise<Output> => {
    const key = JSON.stringify(input);
    const pending = latest.current;
    if (pending?.key === key) {
      return pending.promise;
    }

    const promise: Promise<Output> =
      pending === null
        ? run(input)
        : pending.promise.then(
            () => run(input),
            () => run(input),
          );
    const flight = { key, promise };
    latest.current = flight;
    const clear = () => {
      if (latest.current === flight) {
        latest.current = null;
      }
    };
    promise.then(clear, clear);
    return promise;
  };
}
