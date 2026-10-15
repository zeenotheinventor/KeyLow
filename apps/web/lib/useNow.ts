import { useEffect, useState } from "react";

const ONE_MINUTE = 60_000;

/** The current time, read again every minute, so the hour on the clock moves on while a page stays open. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, ONE_MINUTE);
    return () => {
      clearInterval(timer);
    };
  }, []);

  return now;
}
