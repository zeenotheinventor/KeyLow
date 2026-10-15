import { useEffect, useState } from "react";

const MINUTE_IN_MILLISECONDS = 60_000;

/**
 * The current time, read again every minute, so a screen that shows the current hour or today's date
 * moves on by itself. A screen reads the clock through this hook, so a test can set the time.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, MINUTE_IN_MILLISECONDS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return now;
}
