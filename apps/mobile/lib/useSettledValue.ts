import { useEffect, useState } from "react";

/**
 * A value that follows `value` once it has stood still for `delayMilliseconds`, so work that follows typing
 * (and what a screen reader is told about it) waits until the typing has stopped. The first value is at once.
 */
export function useSettledValue<Value>(value: Value, delayMilliseconds: number): Value {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMilliseconds);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMilliseconds]);

  return settled;
}
