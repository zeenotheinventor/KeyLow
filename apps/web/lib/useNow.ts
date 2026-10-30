import { useEffect, useState } from "react";

const ONE_MINUTE = 60_000;

/**
 * The current time, read again every minute, so the hour on the clock moves on while a page stays open. A
 * screen that shows seconds, such as the clock of a session in progress, asks for a shorter step.
 */
export function useNow(tickMilliseconds: number = ONE_MINUTE): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, tickMilliseconds);
    return () => {
      clearInterval(timer);
    };
  }, [tickMilliseconds]);

  return now;
}
