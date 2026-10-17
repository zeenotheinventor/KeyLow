import { useRef } from "react";

/**
 * Makes a save not re-entrant. While a call is pending, another call does not start a second one: it
 * gets the pending call's promise, so a double press of Save makes one request and both presses see
 * its result. Once the call settles, the next call starts a new one.
 */
export function useSingleFlight<Input, Output>(run: (input: Input) => Promise<Output>) {
  const pending = useRef<Promise<Output> | null>(null);

  return (input: Input): Promise<Output> => {
    pending.current ??= run(input).finally(() => {
      pending.current = null;
    });
    return pending.current;
  };
}
