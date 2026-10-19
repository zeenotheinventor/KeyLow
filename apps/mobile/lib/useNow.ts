import { useEffect, useState } from "react";

const MINUTE_IN_MILLISECONDS = 60_000;

/**
 * The current time, read again every minute, so a screen that shows the current hour or today's date
 * moves on by itself. A screen that shows seconds, such as the clock of a session in progress, asks for a
 * shorter step. A screen reads the clock through this hook, so a test can set the time.
 */
export function useNow(tickMilliseconds: number = MINUTE_IN_MILLISECONDS): Date {
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
